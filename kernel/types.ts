// kernel/types.ts

export interface SkillContext {
  memory:         Record<string, any>;  // session memory
  logger:         any;                  // console or custom logger
  llm:            any;                  // OllamaClient instance
  workspace:      string;               // project root path
  originalQuery:  string;               // original user input — used by skills
  sessionId?:     string;               // optional session identifier
}

export interface Skill {
  name:        string;
  description: string;
  keywords?:   string[];
  execute(input: any, context: SkillContext): Promise<SkillResult>;
}

export interface SkillResult {
  success: boolean;
  output?: any;
  error?:  string;
}
