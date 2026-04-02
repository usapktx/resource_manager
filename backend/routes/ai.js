const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { spawn } = require('child_process');
const path = require('path');

/**
 * Spawns ai_client.py, passes payload as JSON on stdin,
 * and resolves with the response string.
 */
function callFiservAI(payload) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, '..', 'ai_client.py');
    const python = spawn('python3', [scriptPath]);

    let stdout = '';
    let stderr = '';

    python.stdout.on('data', chunk => { stdout += chunk; });
    python.stderr.on('data', chunk => { stderr += chunk; });

    python.on('close', code => {
      try {
        const result = JSON.parse(stdout);
        if (result.error) return reject(new Error(result.error));
        resolve(result.response);
      } catch {
        reject(new Error(stderr || `Python process exited with code ${code}`));
      }
    });

    python.on('error', err => reject(new Error(`Failed to start Python: ${err.message}`)));

    python.stdin.write(JSON.stringify(payload));
    python.stdin.end();
  });
}

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

function addWeeks(dateStr, weeks) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().split('T')[0];
}

function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// POST /api/ai/plan
router.post('/plan', async (req, res) => {
  try {
    const { message, conversationHistory = [] } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    const aiEndpoint = process.env.INTERNAL_AI_ENDPOINT;
    const aiKey = process.env.INTERNAL_AI_KEY;
    const aiSecret = process.env.INTERNAL_AI_SECRET;

    if (!aiEndpoint || !aiKey) {
      return res.status(503).json({
        error: 'AI service is not configured. Please set INTERNAL_AI_ENDPOINT and INTERNAL_AI_KEY in the server environment.'
      });
    }

    // Fetch current resource data
    const resources = db.prepare('SELECT * FROM resources ORDER BY name').all().map(r => ({
      ...r,
      skills: JSON.parse(r.skills || '[]'),
    }));

    const projects = db.prepare('SELECT * FROM projects ORDER BY name').all();

    // Fetch availability for next 8 weeks
    const currentMonday = getMonday(new Date());
    const endWeek = addWeeks(currentMonday, 8);

    const utilization = db.prepare(`
      SELECT
        a.resource_id,
        r.name as resource_name,
        r.role,
        a.week_start,
        SUM(a.percentage) as total_percentage,
        GROUP_CONCAT(p.name || ':' || a.percentage || '%', ', ') as project_breakdown
      FROM allocations a
      JOIN resources r ON a.resource_id = r.id
      JOIN projects p ON a.project_id = p.id
      WHERE a.week_start >= ? AND a.week_start <= ?
      GROUP BY a.resource_id, a.week_start
      ORDER BY r.name, a.week_start
    `).all(currentMonday, endWeek);

    // Build availability map
    const availabilityMap = {};
    resources.forEach(r => {
      availabilityMap[r.id] = {
        name: r.name,
        role: r.role,
        skills: r.skills,
        weeks: {},
      };
    });

    utilization.forEach(u => {
      if (availabilityMap[u.resource_id]) {
        availabilityMap[u.resource_id].weeks[u.week_start] = {
          allocated: u.total_percentage,
          available: Math.max(0, 100 - u.total_percentage),
          breakdown: u.project_breakdown,
        };
      }
    });

    // Build week list
    const weeks = [];
    for (let i = 0; i <= 8; i++) {
      weeks.push(addWeeks(currentMonday, i));
    }

    // Build system prompt
    let systemPrompt = `You are an expert resource planning assistant for a software development team. Your role is to help managers allocate developers to projects efficiently.

Today is ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.
Current week starts: ${currentMonday}

## Available Resources

`;

    resources.forEach(r => {
      const avail = availabilityMap[r.id];
      systemPrompt += `**${r.name}** (${r.role})\n`;
      systemPrompt += `  Skills: ${r.skills.join(', ')}\n`;
      systemPrompt += `  Weekly availability (next 8 weeks):\n`;

      weeks.forEach(week => {
        const weekData = avail.weeks[week];
        const allocated = weekData ? weekData.allocated : 0;
        const available = 100 - allocated;
        const breakdown = weekData ? ` (${weekData.breakdown})` : '';
        systemPrompt += `    ${week}: ${allocated}% allocated, ${available}% available${breakdown}\n`;
      });
      systemPrompt += '\n';
    });

    systemPrompt += `## Active Projects\n\n`;
    projects.filter(p => p.status === 'active').forEach(p => {
      systemPrompt += `- **${p.name}**: ${p.description || 'No description'} (${formatDate(p.start_date)} - ${formatDate(p.end_date)})\n`;
    });

    systemPrompt += `\n## Your Task

When the user describes a new project or resource need:
1. Analyze the requirements (skills needed, duration, team size, workload)
2. Review current availability to find the best fit resources
3. Suggest specific resource allocations with:
   - Resource name and role
   - Allocation percentage per week
   - Which weeks (use Monday dates like ${currentMonday})
   - Brief rationale

4. Format your suggestions clearly. After your explanation, if you have specific allocation suggestions, list them in this format:

SUGGESTIONS:
- Resource: [name] | Project: [project name or "New Project"] | Week: [YYYY-MM-DD] | Percentage: [number] | Notes: [brief note]

Keep suggestions realistic (don't over-allocate anyone beyond 100% total). Be concise and practical.`;

    // Build full prompt: system context + conversation history + current message
    const historyText = conversationHistory
      .map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`)
      .join('\n\n');

    const fullPrompt = [
      systemPrompt,
      historyText ? `\n## Conversation So Far\n\n${historyText}` : '',
      `\nUser: ${message}`,
    ].filter(Boolean).join('\n');

    // Call FiservAI via Python script
    const responseText = await callFiservAI({
      api_key: aiKey,
      api_secret: aiSecret || '',
      endpoint: aiEndpoint,
      prompt: fullPrompt,
    });

    // Parse suggestions from response
    const suggestions = [];
    const suggestionsMatch = responseText.match(/SUGGESTIONS:\n([\s\S]*?)(?:\n\n|$)/);
    if (suggestionsMatch) {
      const suggestionLines = suggestionsMatch[1].split('\n').filter(l => l.trim().startsWith('-'));
      suggestionLines.forEach(line => {
        const resourceMatch = line.match(/Resource:\s*([^|]+)/);
        const projectMatch = line.match(/Project:\s*([^|]+)/);
        const weekMatch = line.match(/Week:\s*([^|]+)/);
        const percentageMatch = line.match(/Percentage:\s*([^|]+)/);
        const notesMatch = line.match(/Notes:\s*(.+)/);

        if (resourceMatch && weekMatch && percentageMatch) {
          const resourceName = resourceMatch[1].trim();
          const resource = resources.find(r =>
            r.name.toLowerCase().includes(resourceName.toLowerCase()) ||
            resourceName.toLowerCase().includes(r.name.toLowerCase().split(' ')[0])
          );
          const projectName = projectMatch ? projectMatch[1].trim() : 'New Project';
          const project = projects.find(p =>
            p.name.toLowerCase().includes(projectName.toLowerCase()) ||
            projectName.toLowerCase().includes(p.name.toLowerCase().split(' ')[0])
          );

          suggestions.push({
            resource_id: resource ? resource.id : null,
            resource_name: resource ? resource.name : resourceName,
            project_id: project ? project.id : null,
            project_name: projectName,
            week_start: weekMatch[1].trim(),
            percentage: parseInt(percentageMatch[1].trim()) || 50,
            notes: notesMatch ? notesMatch[1].trim() : '',
          });
        }
      });
    }

    res.json({
      response: responseText,
      suggestions,
    });
  } catch (err) {
    console.error('AI planning error:', err);
    res.status(500).json({ error: err.message || 'AI planning failed' });
  }
});

module.exports = router;
