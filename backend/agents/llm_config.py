from langchain_openai import ChatOpenAI
import os

def get_llm(model='meta-llama/llama-3.1-8b-instruct:free'):
    """
    Returns a LangChain ChatOpenAI instance configured for OpenRouter.
    Free models available:
      - meta-llama/llama-3.1-8b-instruct:free
      - mistralai/mistral-7b-instruct:free
    """
    return ChatOpenAI(
        model=model,
        openai_api_key=os.getenv('OPENROUTER_API_KEY'),
        openai_api_base='https://openrouter.ai/api/v1',
        max_tokens=1024,
        temperature=0.2,  # Low temperature for consistent agent outputs
        default_headers={
            'HTTP-Referer': 'http://localhost:3000',
            'X-Title': 'Supply Chain PO Automation'
        }
    )
