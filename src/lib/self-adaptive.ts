// Self-Adaptive (Autonomic) System - Monitors and adapts its own behavior

export interface AdaptiveParameter {
  name: string;
  value: number;
  min: number;
  max: number;
  adaptationRate: number;
  performanceHistory: Array<{ value: number; performance: number; timestamp: number }>;
}

export interface PerformanceMetric {
  name: string;
  value: number;
  target?: number;
  threshold?: { min: number; max: number };
  timestamp: number;
}

export interface AdaptationAction {
  parameter: string;
  oldValue: number;
  newValue: number;
  reason: string;
  timestamp: number;
}

export class SelfAdaptiveSystem {
  private parameters: Map<string, AdaptiveParameter> = new Map();
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private adaptationHistory: AdaptationAction[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private adaptationEnabled: boolean = true;

  // MAPE-K loop (Monitor, Analyze, Plan, Execute, Knowledge)
  private monitorCallbacks: Array<() => Promise<PerformanceMetric[]>> = [];
  private knowledgeBase: Map<string, any> = new Map();

  constructor() {
    this.initializeDefaultParameters();
  }

  private initializeDefaultParameters(): void {
    // Default adaptive parameters
    this.addParameter('response_timeout', 30000, 1000, 60000, 0.1);
    this.addParameter('max_retries', 3, 1, 10, 0.2);
    this.addParameter('batch_size', 10, 1, 100, 0.15);
    this.addParameter('learning_rate', 0.1, 0.01, 1.0, 0.05);
    this.addParameter('exploration_rate', 0.2, 0.0, 1.0, 0.1);
  }

  // Add an adaptive parameter
  addParameter(
    name: string,
    initialValue: number,
    min: number,
    max: number,
    adaptationRate: number = 0.1
  ): void {
    this.parameters.set(name, {
      name,
      value: initialValue,
      min,
      max,
      adaptationRate,
      performanceHistory: [],
    });
  }

  // Get parameter value
  getParameter(name: string): number {
    return this.parameters.get(name)?.value || 0;
  }

  // Set parameter value manually
  setParameter(name: string, value: number): void {
    const param = this.parameters.get(name);
    if (param) {
      param.value = Math.max(param.min, Math.min(param.max, value));
    }
  }

  // Add a metric for monitoring
  addMetric(metric: PerformanceMetric): void {
    if (!this.metrics.has(metric.name)) {
      this.metrics.set(metric.name, []);
    }
    
    const metricHistory = this.metrics.get(metric.name)!;
    metricHistory.push(metric);

    // Keep only last 100 metrics per type
    if (metricHistory.length > 100) {
      metricHistory.shift();
    }
  }

  // Register a monitoring callback
  onMonitor(callback: () => Promise<PerformanceMetric[]>): void {
    this.monitorCallbacks.push(callback);
  }

  // MAPE-K: Monitor phase
  private async monitor(): Promise<PerformanceMetric[]> {
    const allMetrics: PerformanceMetric[] = [];

    for (const callback of this.monitorCallbacks) {
      try {
        const metrics = await callback();
        metrics.forEach(m => this.addMetric(m));
        allMetrics.push(...metrics);
      } catch (error) {
        console.error('Monitor callback error:', error);
      }
    }

    return allMetrics;
  }

  // MAPE-K: Analyze phase
  private analyze(metrics: PerformanceMetric[]): Map<string, { issue: string; severity: number }> {
    const issues = new Map<string, { issue: string; severity: number }>();

    for (const metric of metrics) {
      // Check if metric is out of bounds
      if (metric.threshold) {
        if (metric.value < metric.threshold.min) {
          issues.set(metric.name, {
            issue: `${metric.name} below threshold: ${metric.value} < ${metric.threshold.min}`,
            severity: (metric.threshold.min - metric.value) / metric.threshold.min,
          });
        } else if (metric.value > metric.threshold.max) {
          issues.set(metric.name, {
            issue: `${metric.name} above threshold: ${metric.value} > ${metric.threshold.max}`,
            severity: (metric.value - metric.threshold.max) / metric.threshold.max,
          });
        }
      }

      // Check if metric is far from target
      if (metric.target !== undefined) {
        const deviation = Math.abs(metric.value - metric.target) / metric.target;
        if (deviation > 0.2) {
          issues.set(metric.name, {
            issue: `${metric.name} deviating from target: ${metric.value} vs ${metric.target}`,
            severity: deviation,
          });
        }
      }
    }

    // Analyze trends
    for (const [name, history] of this.metrics.entries()) {
      if (history.length >= 3) {
        const recent = history.slice(-3);
        const trend = this.calculateTrend(recent.map(m => m.value));
        
        if (Math.abs(trend) > 0.3) {
          issues.set(`${name}_trend`, {
            issue: `${name} showing ${trend > 0 ? 'upward' : 'downward'} trend`,
            severity: Math.abs(trend),
          });
        }
      }
    }

    return issues;
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;
    
    const n = values.length;
    const indices = Array.from({ length: n }, (_, i) => i);
    
    const sumX = indices.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = indices.reduce((sum, x, i) => sum + x * values[i], 0);
    const sumX2 = indices.reduce((sum, x) => sum + x * x, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope / (sumY / n); // Normalize by mean
  }

  // MAPE-K: Plan phase
  private plan(
    issues: Map<string, { issue: string; severity: number }>
  ): AdaptationAction[] {
    const actions: AdaptationAction[] = [];

    // Use knowledge base to plan adaptations
    for (const [issueName, issueData] of issues.entries()) {
      // Check knowledge base for similar past issues
      const similarIssue = this.knowledgeBase.get(issueName);
      
      if (similarIssue) {
        // Use past successful adaptation
        actions.push(similarIssue);
      } else {
        // Generate new adaptation based on issue type
        const action = this.generateAdaptation(issueName, issueData);
        if (action) {
          actions.push(action);
        }
      }
    }

    // Prioritize by severity
    actions.sort((a, b) => {
      const severityA = issues.get(a.parameter)?.severity || 0;
      const severityB = issues.get(b.parameter)?.severity || 0;
      return severityB - severityA;
    });

    return actions;
  }

  private generateAdaptation(
    issueName: string,
    issue: { issue: string; severity: number }
  ): AdaptationAction | null {
    // Map issues to parameter adaptations
    const adaptationMap: Record<string, { param: string; direction: number }> = {
      'response_time': { param: 'response_timeout', direction: 1 },
      'error_rate': { param: 'max_retries', direction: 1 },
      'throughput': { param: 'batch_size', direction: 1 },
      'accuracy': { param: 'learning_rate', direction: -1 },
    };

    for (const [metricType, adaptation] of Object.entries(adaptationMap)) {
      if (issueName.includes(metricType)) {
        const param = this.parameters.get(adaptation.param);
        if (!param) continue;

        const delta = param.adaptationRate * (param.max - param.min) * adaptation.direction;
        const newValue = Math.max(param.min, Math.min(param.max, param.value + delta));

        return {
          parameter: adaptation.param,
          oldValue: param.value,
          newValue,
          reason: issue.issue,
          timestamp: Date.now(),
        };
      }
    }

    return null;
  }

  // MAPE-K: Execute phase
  private execute(actions: AdaptationAction[]): void {
    for (const action of actions) {
      const param = this.parameters.get(action.parameter);
      if (param) {
        param.value = action.newValue;
        this.adaptationHistory.push(action);

        // Update knowledge base
        this.knowledgeBase.set(action.parameter, action);
      }
    }

    // Keep limited adaptation history
    if (this.adaptationHistory.length > 100) {
      this.adaptationHistory = this.adaptationHistory.slice(-100);
    }
  }

  // Run full MAPE-K loop
  async adapt(): Promise<AdaptationAction[]> {
    if (!this.adaptationEnabled) {
      return [];
    }

    try {
      // Monitor
      const metrics = await this.monitor();

      // Analyze
      const issues = this.analyze(metrics);

      if (issues.size === 0) {
        return [];
      }

      // Plan
      const actions = this.plan(issues);

      // Execute
      this.execute(actions);

      return actions;
    } catch (error) {
      console.error('Adaptation error:', error);
      return [];
    }
  }

  // Start autonomous monitoring and adaptation
  startAutonomous(intervalMs: number = 5000): void {
    if (this.monitoringInterval) {
      return; // Already running
    }

    this.monitoringInterval = setInterval(async () => {
      await this.adapt();
    }, intervalMs);
  }

  // Stop autonomous operation
  stopAutonomous(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  // Enable/disable adaptation
  setAdaptationEnabled(enabled: boolean): void {
    this.adaptationEnabled = enabled;
  }

  // Get current system state
  getState(): {
    parameters: Record<string, number>;
    recentMetrics: Record<string, PerformanceMetric[]>;
    recentAdaptations: AdaptationAction[];
  } {
    return {
      parameters: Object.fromEntries(
        Array.from(this.parameters.entries()).map(([name, param]) => [name, param.value])
      ),
      recentMetrics: Object.fromEntries(this.metrics),
      recentAdaptations: this.adaptationHistory.slice(-10),
    };
  }

  // Record performance for a parameter value
  recordPerformance(parameterName: string, performance: number): void {
    const param = this.parameters.get(parameterName);
    if (param) {
      param.performanceHistory.push({
        value: param.value,
        performance,
        timestamp: Date.now(),
      });

      // Keep only last 50 records
      if (param.performanceHistory.length > 50) {
        param.performanceHistory.shift();
      }
    }
  }

  // Use reinforcement learning to optimize parameters
  optimizeParameter(parameterName: string): void {
    const param = this.parameters.get(parameterName);
    if (!param || param.performanceHistory.length < 10) {
      return;
    }

    // Find value that historically gave best performance
    const bestRecord = param.performanceHistory.reduce((best, current) =>
      current.performance > best.performance ? current : best
    );

    // Move towards best value with learning rate
    const delta = (bestRecord.value - param.value) * param.adaptationRate;
    param.value = Math.max(param.min, Math.min(param.max, param.value + delta));
  }

  // Get adaptation history
  getAdaptationHistory(): AdaptationAction[] {
    return [...this.adaptationHistory];
  }

  // Clear all history
  reset(): void {
    this.metrics.clear();
    this.adaptationHistory = [];
    this.knowledgeBase.clear();
    this.initializeDefaultParameters();
  }
}

// Singleton instance
export const adaptiveSystem = new SelfAdaptiveSystem();
