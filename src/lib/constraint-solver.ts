// Constraint Programming Solver - Solves CSP (Constraint Satisfaction Problems)

export interface Variable {
  name: string;
  domain: number[];
  value?: number;
}

export interface Constraint {
  type: 'binary' | 'nary' | 'global';
  variables: string[];
  predicate: (assignment: Record<string, number>) => boolean;
  description: string;
}

export interface CSProblem {
  variables: Variable[];
  constraints: Constraint[];
}

/**
 * Serializable constraint specs.
 *
 * Constraint.predicate is a JS closure and cannot survive JSON
 * serialization over the wire. Clients must send ConstraintSpec objects
 * (kind + params only); the server reconstructs real Constraint objects
 * (with live predicate functions) via `buildConstraint` / `buildProblem`
 * below. This fixes the "predicate is undefined" bug that broke every
 * constraint problem submitted from the browser.
 */
export type ConstraintSpec =
  | { kind: 'allDifferent'; variables: string[] }
  | { kind: 'lessThan'; variables: [string, string] }
  | { kind: 'lessThanOrEqual'; variables: [string, string] }
  | { kind: 'equals'; variables: [string, string] }
  | { kind: 'notEquals'; variables: [string, string] }
  | { kind: 'sum'; variables: string[]; target: number };

export interface CSProblemSpec {
  variables: Variable[];
  constraints: ConstraintSpec[];
}

export function buildConstraint(spec: ConstraintSpec): Constraint {
  switch (spec.kind) {
    case 'allDifferent':
      return Constraints.allDifferent(spec.variables);
    case 'lessThan':
      return Constraints.lessThan(spec.variables[0], spec.variables[1]);
    case 'lessThanOrEqual':
      return Constraints.lessThanOrEqual(spec.variables[0], spec.variables[1]);
    case 'equals':
      return Constraints.equals(spec.variables[0], spec.variables[1]);
    case 'notEquals':
      return Constraints.notEquals(spec.variables[0], spec.variables[1]);
    case 'sum':
      return Constraints.sum(spec.variables, spec.target);
    default: {
      const _exhaustive: never = spec;
      throw new Error(`Unknown constraint kind: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

export function buildProblem(spec: CSProblemSpec): CSProblem {
  return {
    variables: spec.variables,
    constraints: spec.constraints.map(buildConstraint),
  };
}

export interface Solution {
  assignment: Record<string, number>;
  backtrackCount: number;
  timeMs: number;
}

export class ConstraintSolver {
  private problem: CSProblem;
  private backtrackCount: number = 0;
  private startTime: number = 0;

  constructor(problem: CSProblem) {
    // Shallow-copy variables (plain data) but keep constraint objects
    // (and their predicate closures) intact — JSON.stringify would strip
    // the predicate functions entirely.
    this.problem = {
      variables: problem.variables.map((v) => ({ ...v, domain: [...v.domain] })),
      constraints: problem.constraints,
    };
  }

  // Check if assignment is consistent with all constraints
  private isConsistent(assignment: Record<string, number>): boolean {
    return this.problem.constraints.every(constraint => {
      // Only check constraints where all variables are assigned
      const allAssigned = constraint.variables.every(v => assignment[v] !== undefined);
      
      if (!allAssigned) {
        return true; // Can't check yet
      }

      return constraint.predicate(assignment);
    });
  }

  // Forward checking - prune domains based on current assignment
  private forwardCheck(
    variable: string,
    value: number,
    domains: Map<string, number[]>
  ): Map<string, number[]> | null {
    const newDomains = new Map(domains);
    const assignment: Record<string, number> = {};
    
    // Build current assignment
    for (const [v, domain] of newDomains.entries()) {
      if (domain.length === 1) {
        assignment[v] = domain[0];
      }
    }
    assignment[variable] = value;

    // Check each unassigned variable
    for (const v of this.problem.variables.map(x => x.name)) {
      if (v === variable || assignment[v] !== undefined) continue;

      const domain = newDomains.get(v)!;
      const validValues = domain.filter(val => {
        const testAssignment = { ...assignment, [v]: val };
        return this.isConsistent(testAssignment);
      });

      if (validValues.length === 0) {
        return null; // Domain wipeout
      }

      newDomains.set(v, validValues);
    }

    return newDomains;
  }

  // Select next unassigned variable (MRV heuristic - Minimum Remaining Values)
  private selectUnassignedVariable(
    assignment: Record<string, number>,
    domains: Map<string, number[]>
  ): string | null {
    let minSize = Infinity;
    let selected: string | null = null;

    for (const variable of this.problem.variables) {
      if (assignment[variable.name] === undefined) {
        const domainSize = domains.get(variable.name)!.length;
        if (domainSize < minSize) {
          minSize = domainSize;
          selected = variable.name;
        }
      }
    }

    return selected;
  }

  // Order domain values (Least Constraining Value heuristic)
  private orderDomainValues(
    variable: string,
    domains: Map<string, number[]>
  ): number[] {
    const domain = domains.get(variable)!;
    
    // Count how many values each choice removes from other variables
    const valueCosts = domain.map(value => {
      let cost = 0;
      const testDomains = this.forwardCheck(variable, value, domains);
      
      if (!testDomains) {
        return { value, cost: Infinity };
      }

      for (const [v, d] of testDomains.entries()) {
        if (v !== variable) {
          cost += domains.get(v)!.length - d.length;
        }
      }

      return { value, cost };
    });

    // Sort by cost (least constraining first)
    valueCosts.sort((a, b) => a.cost - b.cost);
    return valueCosts.map(x => x.value);
  }

  // Backtracking search with constraint propagation
  private backtrack(
    assignment: Record<string, number>,
    domains: Map<string, number[]>
  ): Record<string, number> | null {
    this.backtrackCount++;

    // Check if assignment is complete
    if (Object.keys(assignment).length === this.problem.variables.length) {
      return assignment;
    }

    // Select next variable
    const variable = this.selectUnassignedVariable(assignment, domains);
    if (!variable) return null;

    // Try values in order
    const orderedValues = this.orderDomainValues(variable, domains);

    for (const value of orderedValues) {
      const newAssignment = { ...assignment, [variable]: value };

      if (this.isConsistent(newAssignment)) {
        // Forward check
        const newDomains = this.forwardCheck(variable, value, domains);

        if (newDomains !== null) {
          const result = this.backtrack(newAssignment, newDomains);
          if (result !== null) {
            return result;
          }
        }
      }
    }

    return null;
  }

  // Solve the CSP
  solve(): Solution | null {
    this.backtrackCount = 0;
    this.startTime = Date.now();

    // Initialize domains
    const domains = new Map<string, number[]>();
    for (const variable of this.problem.variables) {
      domains.set(variable.name, [...variable.domain]);
    }

    // Initial constraint propagation
    let changed = true;
    while (changed) {
      changed = false;
      
      for (const variable of this.problem.variables) {
        const domain = domains.get(variable.name)!;
        const validValues = domain.filter(value => {
          const assignment: Record<string, number> = { [variable.name]: value };
          
          // Check if this value is compatible with constraints
          for (const constraint of this.problem.constraints) {
            if (constraint.variables.includes(variable.name)) {
              // Simple arc consistency
              const otherVars = constraint.variables.filter(v => v !== variable.name);
              if (otherVars.length === 0) {
                if (!constraint.predicate(assignment)) {
                  return false;
                }
              }
            }
          }
          
          return true;
        });

        if (validValues.length < domain.length) {
          domains.set(variable.name, validValues);
          changed = true;
        }

        if (validValues.length === 0) {
          return null; // No solution
        }
      }
    }

    // Run backtracking search
    const assignment = this.backtrack({}, domains);

    if (assignment === null) {
      return null;
    }

    return {
      assignment,
      backtrackCount: this.backtrackCount,
      timeMs: Date.now() - this.startTime,
    };
  }

  // AC-3 Algorithm for Arc Consistency
  ac3(): boolean {
    const domains = new Map<string, number[]>();
    for (const variable of this.problem.variables) {
      domains.set(variable.name, [...variable.domain]);
    }

    const queue: Array<[string, string]> = [];

    // Initialize queue with all arcs
    for (const constraint of this.problem.constraints) {
      if (constraint.type === 'binary' && constraint.variables.length === 2) {
        const [v1, v2] = constraint.variables;
        queue.push([v1, v2]);
        queue.push([v2, v1]);
      }
    }

    while (queue.length > 0) {
      const [xi, xj] = queue.shift()!;
      
      if (this.revise(xi, xj, domains)) {
        const domain = domains.get(xi)!;
        
        if (domain.length === 0) {
          return false; // Inconsistent
        }

        // Add arcs (xk, xi) for all xk neighbors of xi
        for (const constraint of this.problem.constraints) {
          if (constraint.variables.includes(xi)) {
            for (const xk of constraint.variables) {
              if (xk !== xi && xk !== xj) {
                queue.push([xk, xi]);
              }
            }
          }
        }
      }
    }

    // Update domains
    for (const variable of this.problem.variables) {
      variable.domain = domains.get(variable.name)!;
    }

    return true;
  }

  private revise(
    xi: string,
    xj: string,
    domains: Map<string, number[]>
  ): boolean {
    let revised = false;
    const xiDomain = domains.get(xi)!;
    const xjDomain = domains.get(xj)!;

    const newDomain = xiDomain.filter(vi => {
      // Check if there exists a value in xj domain that satisfies constraint
      return xjDomain.some(vj => {
        const assignment = { [xi]: vi, [xj]: vj };
        return this.isConsistent(assignment);
      });
    });

    if (newDomain.length < xiDomain.length) {
      domains.set(xi, newDomain);
      revised = true;
    }

    return revised;
  }
}

// Predefined constraint factories
export const Constraints = {
  allDifferent: (variables: string[]): Constraint => ({
    type: 'global',
    variables,
    description: `All ${variables.join(', ')} must be different`,
    predicate: (assignment) => {
      const values = variables.map(v => assignment[v]).filter(v => v !== undefined);
      return new Set(values).size === values.length;
    },
  }),

  lessThan: (v1: string, v2: string): Constraint => ({
    type: 'binary',
    variables: [v1, v2],
    description: `${v1} < ${v2}`,
    predicate: (assignment) => {
      if (assignment[v1] === undefined || assignment[v2] === undefined) return true;
      return assignment[v1] < assignment[v2];
    },
  }),

  lessThanOrEqual: (v1: string, v2: string): Constraint => ({
    type: 'binary',
    variables: [v1, v2],
    description: `${v1} <= ${v2}`,
    predicate: (assignment) => {
      if (assignment[v1] === undefined || assignment[v2] === undefined) return true;
      return assignment[v1] <= assignment[v2];
    },
  }),

  equals: (v1: string, v2: string): Constraint => ({
    type: 'binary',
    variables: [v1, v2],
    description: `${v1} = ${v2}`,
    predicate: (assignment) => {
      if (assignment[v1] === undefined || assignment[v2] === undefined) return true;
      return assignment[v1] === assignment[v2];
    },
  }),

  notEquals: (v1: string, v2: string): Constraint => ({
    type: 'binary',
    variables: [v1, v2],
    description: `${v1} ≠ ${v2}`,
    predicate: (assignment) => {
      if (assignment[v1] === undefined || assignment[v2] === undefined) return true;
      return assignment[v1] !== assignment[v2];
    },
  }),

  sum: (variables: string[], target: number): Constraint => ({
    type: 'nary',
    variables,
    description: `${variables.join(' + ')} = ${target}`,
    predicate: (assignment) => {
      const values = variables.map(v => assignment[v]);
      if (values.some(v => v === undefined)) return true;
      return values.reduce((a, b) => a! + b!, 0) === target;
    },
  }),
};
