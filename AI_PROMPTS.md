# AI_PROMPTS.md

## Overview

AI tools were used throughout the development process to accelerate implementation, troubleshoot issues, and improve code quality. The goal was not to generate the entire application automatically, but to use AI as a development assistant for research, debugging, refactoring, and documentation.

---

Prompt 1: RAG Architecture Planning

Task: Design a simple Retrieval-Augmented Generation (RAG) workflow using a React frontend and Node.js backend.

Outcome: Defined the overall flow for document ingestion, chunking, embedding generation, retrieval, and answer generation with citations.

---

# Prompt 2: Text Chunking Strategy

### Prompt

> What is a simple and effective text chunking strategy for a small RAG application that processes text documents?

### Outcome

Implemented chunk-based splitting with configurable chunk sizes and overlap to improve retrieval quality while keeping the implementation lightweight.

Key considerations:

- Avoid excessively large chunks
- Preserve context between chunks
- Improve retrieval accuracy

---

# Prompt 3: Embedding Integration

### Prompt

> Show how to generate embeddings for document chunks and user queries using an AI embedding model, and calculate cosine similarity for retrieval.

### Outcome

Used AI guidance to implement:

- Embedding generation
- Vector storage
- Cosine similarity search
- Top-k retrieval

This became the core retrieval mechanism for the application.

---

# Prompt 4: Prompt Construction

### Prompt

> Create a system prompt that forces the model to answer only from the supplied context and avoid using external knowledge.

### Outcome

Created a constrained prompt strategy:

- Use only retrieved context
- Refuse answers not present in the document
- Return concise responses
- Preserve factual accuracy

This reduced hallucinations and improved answer reliability.

---

# Prompt 5: Debugging API Failures

### Prompt

> Help diagnose Gemini embedding timeouts and intermittent API failures during document ingestion.

### Outcome

Used AI assistance to:

- Add retry mechanisms
- Improve logging
- Limit context size
- Reduce embedding request volume
- Identify networking and timeout issues

---

# Prompt 9: Documentation

### Prompt

> Generate concise documentation explaining how to run the project locally, with Docker, and how the RAG workflow functions.

### Outcome

Created:

- Step-by-step setup guide
- Environment configuration instructions
- API usage examples
- Troubleshooting documentation

---

# Summary

AI was primarily used as a development assistant to:

- Accelerate implementation
- Explore design alternatives
- Debug integration issues
- Refactor code
- Improve documentation
