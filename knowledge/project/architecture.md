# Glide Architecture

## Overview

Glide is an AI Agent runtime that processes user queries through a pipeline of **planning → execution → aggregation**. It is designed to be modular, extensible, and self‑improving.

## Core Components

### Kernel (`kernel/`)
- **EventBus**: Global event publisher/subscriber
- **SkillRegistry**: Manages available skills
- **OllamaClient**: LLM interface (supports multiple models)
- **ConsciousLoop**: Background introspection and scheduling
- **GoalEngine**: Long‑term goal management

### Runtime (`runtime/`)
- **Orchestrator**: Plans, executes, and aggregates skills
- **Aggregator**: Synthesizes skill outputs into final answer
- **Agent**: Top‑level interface, loads skills, manages sessions
- **UILog**: Logging for frontend display

### Skills (`skills/`)
- **customer**: Customer profile retrieval by name/location
- **sales**: Sales analytics (revenue, top customers, monthly reports)
- **knowledge_retrieval**: Document search in `knowledge/` and indexes
- **support**: Support ticket lookup
- **skill_generator**: Creates new skills from natural language
- **tool**: Utility calculations (add, uppercase, etc.)

### Knowledge Layers (`constitution/`, `policy/`, `knowledge/`)
- **Constitution**: Immutable rules (identity, safety, decision)
- **Policy**: Changeable execution policies (auto‑approval, privacy, retry)
- **Knowledge**: Static facts, documents, user profile, failures

## Data Flow
User query → Agent.process()
→ Orchestrator.think() (load constitution + policy)
→ Orchestrator.plan() (LLM generates skill steps)
→ Orchestrator.execute() (run skills in parallel)
→ Aggregator.aggregate() (LLM synthesizes answer)
→ Return result + timeline

## Directory Structure

glide/
├── constitution/ # Immutable rules
├── policy/ # Changeable policies
├── knowledge/ # Static knowledge
├── skills/ # Executable skills
├── runtime/ # Orchestrator, Agent, tasks
├── kernel/ # EventBus, Registry, LLM client
├── memory/ # Indexes and conversation logs
├── apps/ # Dashboard (frontend) + HTTP server
└── tools/ # Utility scripts

## Phase Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Stabilise Agent Runtime | In progress |
| 2 | Memory System + Event Driven | Planned |
| 3 | Self‑Evolution | Planned |
| 4 | Silent Automation | Planned |
| 5 | Multi‑Agent Society | Planned |
