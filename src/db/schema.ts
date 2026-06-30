import { pgTable, serial, text, timestamp, integer, jsonb, boolean, real } from 'drizzle-orm/pg-core';

// Conversations with Claude
export const conversations = pgTable('conversations', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Messages in conversations
export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  conversationId: integer('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  role: text('role').notNull(), // 'user' | 'assistant' | 'system'
  content: text('content').notNull(),
  tokens: integer('tokens'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Genetic Programming - evolved solutions
export const evolvedSolutions = pgTable('evolved_solutions', {
  id: serial('id').primaryKey(),
  problemType: text('problem_type').notNull(), // 'optimization', 'search', 'pattern', etc.
  problemDescription: text('problem_description').notNull(),
  generation: integer('generation').notNull().default(0),
  fitness: real('fitness').notNull(),
  genome: jsonb('genome').notNull(), // The actual evolved program/solution
  parentIds: jsonb('parent_ids'), // Array of parent solution IDs
  metadata: jsonb('metadata'), // Additional info about the solution
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Constraint Problems and Solutions
export const constraintProblems = pgTable('constraint_problems', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  variables: jsonb('variables').notNull(), // Variable definitions
  constraints: jsonb('constraints').notNull(), // Constraint definitions
  solution: jsonb('solution'), // Solved values
  solutionMethod: text('solution_method'), // Method used to solve
  solvingTime: integer('solving_time'), // Time in ms
  isSolved: boolean('is_solved').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  solvedAt: timestamp('solved_at'),
});

// Neuro-Symbolic Knowledge Base
export const knowledgeBase = pgTable('knowledge_base', {
  id: serial('id').primaryKey(),
  concept: text('concept').notNull(),
  category: text('category').notNull(), // 'fact', 'rule', 'procedure', 'heuristic'
  symbolicRepresentation: jsonb('symbolic_representation').notNull(),
  neuralEmbedding: jsonb('neural_embedding'), // Vector representation from Claude
  confidence: real('confidence').default(1.0).notNull(),
  usageCount: integer('usage_count').default(0).notNull(),
  lastUsed: timestamp('last_used'),
  source: text('source'), // Where this knowledge came from
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Self-Adaptive System Metrics
export const systemMetrics = pgTable('system_metrics', {
  id: serial('id').primaryKey(),
  metricType: text('metric_type').notNull(), // 'performance', 'accuracy', 'resource', etc.
  metricName: text('metric_name').notNull(),
  value: real('value').notNull(),
  threshold: real('threshold'),
  parameters: jsonb('parameters'), // System parameters at time of measurement
  adaptationTrigger: boolean('adaptation_trigger').default(false).notNull(),
  context: jsonb('context'), // Environmental context
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

// Adaptive Parameters - system learns and adjusts these
export const adaptiveParameters = pgTable('adaptive_parameters', {
  id: serial('id').primaryKey(),
  parameterName: text('parameter_name').notNull().unique(),
  currentValue: real('current_value').notNull(),
  minValue: real('min_value').notNull(),
  maxValue: real('max_value').notNull(),
  adaptationRate: real('adaptation_rate').default(0.1).notNull(),
  performanceHistory: jsonb('performance_history'), // Track how changes affect performance
  lastAdapted: timestamp('last_adapted').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Reactive Event Stream History
export const eventStreams = pgTable('event_streams', {
  id: serial('id').primaryKey(),
  streamName: text('stream_name').notNull(),
  eventType: text('event_type').notNull(),
  eventData: jsonb('event_data').notNull(),
  sourceComponent: text('source_component'),
  targetComponents: jsonb('target_components'), // Array of components that should react
  processed: boolean('processed').default(false).notNull(),
  processingResults: jsonb('processing_results'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

// User preferences and settings
export const userSettings = pgTable('user_settings', {
  id: serial('id').primaryKey(),
  settingKey: text('setting_key').notNull().unique(),
  settingValue: jsonb('setting_value').notNull(),
  category: text('category').notNull(), // 'ui', 'ai', 'performance', etc.
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
