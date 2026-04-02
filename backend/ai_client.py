"""
FiservAI client script.
Called by the Node.js backend via child_process.
Reads a JSON payload from stdin, calls FiservAI, writes JSON to stdout.

Input (stdin JSON):
  {
    "api_key": "...",
    "api_secret": "...",
    "endpoint": "https://...",   # optional
    "prompt": "full prompt text"
  }

Output (stdout JSON):
  { "response": "AI response text" }
  or on error:
  { "error": "error message" }
"""

import sys
import json
import asyncio

def main():
    try:
        data = json.loads(sys.stdin.read())
    except Exception as e:
        print(json.dumps({"error": f"Failed to parse input: {e}"}))
        sys.exit(1)

    api_key   = data.get("api_key", "")
    api_secret = data.get("api_secret", "")
    endpoint  = data.get("endpoint") or None
    prompt    = data.get("prompt", "")

    if not api_key or not prompt:
        print(json.dumps({"error": "api_key and prompt are required"}))
        sys.exit(1)

    try:
        from fiservai import FiservAI

        client = FiservAI.FiservAI(
            api_key,
            api_secret,
            base_url=endpoint,
            temperature=0.0,
        )

        resp = asyncio.run(client.chat_completion_async(prompt))

        # resp may be a string or an object with a text/content attribute
        if isinstance(resp, str):
            response_text = resp
        elif hasattr(resp, "content"):
            response_text = resp.content
        elif hasattr(resp, "text"):
            response_text = resp.text
        else:
            response_text = str(resp)

        print(json.dumps({"response": response_text}))

    except ImportError:
        print(json.dumps({"error": "fiservai package is not installed. Run: pip install fiservai"}))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
