// Reactive Programming with RxJS - Event-driven reactive streams

import { Subject, BehaviorSubject, ReplaySubject, Observable, merge, fromEvent } from 'rxjs';
import { map, filter, debounceTime, distinctUntilChanged, scan, share, throttleTime } from 'rxjs/operators';

export interface ReactiveEvent<T = any> {
  type: string;
  data: T;
  timestamp: number;
  source: string;
}

export class ReactiveStreamManager {
  private streams: Map<string, Subject<ReactiveEvent>> = new Map();
  private stateStreams: Map<string, BehaviorSubject<any>> = new Map();
  private historyStreams: Map<string, ReplaySubject<ReactiveEvent>> = new Map();

  // Create or get an event stream
  getStream(name: string): Subject<ReactiveEvent> {
    if (!this.streams.has(name)) {
      this.streams.set(name, new Subject<ReactiveEvent>());
    }
    return this.streams.get(name)!;
  }

  // Create or get a state stream (holds latest value)
  getStateStream<T>(name: string, initialValue: T): BehaviorSubject<T> {
    if (!this.stateStreams.has(name)) {
      this.stateStreams.set(name, new BehaviorSubject<T>(initialValue));
    }
    return this.stateStreams.get(name)! as BehaviorSubject<T>;
  }

  // Create or get a history stream (replays last N events)
  getHistoryStream(name: string, bufferSize: number = 10): ReplaySubject<ReactiveEvent> {
    if (!this.historyStreams.has(name)) {
      this.historyStreams.set(name, new ReplaySubject<ReactiveEvent>(bufferSize));
    }
    return this.historyStreams.get(name)!;
  }

  // Emit an event to a stream
  emit(streamName: string, eventType: string, data: any, source: string = 'system'): void {
    const event: ReactiveEvent = {
      type: eventType,
      data,
      timestamp: Date.now(),
      source,
    };

    const stream = this.getStream(streamName);
    stream.next(event);

    // Also emit to history stream if it exists
    if (this.historyStreams.has(streamName)) {
      this.historyStreams.get(streamName)!.next(event);
    }
  }

  // Subscribe to a stream with type filtering
  subscribe<T = any>(
    streamName: string,
    eventType: string | null,
    callback: (event: ReactiveEvent<T>) => void
  ): () => void {
    const stream = this.getStream(streamName);
    
    const observable = eventType
      ? stream.pipe(filter(event => event.type === eventType))
      : stream;

    const subscription = observable.subscribe(callback);
    
    return () => subscription.unsubscribe();
  }

  // Create a derived stream that combines multiple streams
  combineStreams(
    streamNames: string[],
    combiner: (events: ReactiveEvent[]) => ReactiveEvent
  ): Observable<ReactiveEvent> {
    const streams = streamNames.map(name => this.getStream(name));
    return merge(...streams).pipe(
      scan((acc: ReactiveEvent[], event) => {
        acc.push(event);
        return acc.slice(-streamNames.length);
      }, []),
      filter(events => events.length === streamNames.length),
      map(combiner),
      share()
    );
  }

  // Create a debounced stream (useful for search inputs, etc.)
  createDebouncedStream(
    streamName: string,
    debounceMs: number = 300
  ): Observable<ReactiveEvent> {
    return this.getStream(streamName).pipe(
      debounceTime(debounceMs),
      share()
    );
  }

  // Create a throttled stream (limit event rate)
  createThrottledStream(
    streamName: string,
    throttleMs: number = 1000
  ): Observable<ReactiveEvent> {
    return this.getStream(streamName).pipe(
      throttleTime(throttleMs),
      share()
    );
  }

  // Create a stream that only emits distinct values
  createDistinctStream(
    streamName: string,
    keySelector?: (event: ReactiveEvent) => any
  ): Observable<ReactiveEvent> {
    const selector = keySelector || ((event: ReactiveEvent) => JSON.stringify(event.data));
    
    return this.getStream(streamName).pipe(
      distinctUntilChanged((a, b) => selector(a) === selector(b)),
      share()
    );
  }

  // Clear all streams
  clearAll(): void {
    this.streams.forEach(stream => stream.complete());
    this.stateStreams.forEach(stream => stream.complete());
    this.historyStreams.forEach(stream => stream.complete());
    
    this.streams.clear();
    this.stateStreams.clear();
    this.historyStreams.clear();
  }

  // Get all stream names
  getStreamNames(): string[] {
    return Array.from(this.streams.keys());
  }
}

// Singleton instance
export const reactiveStreams = new ReactiveStreamManager();

// Reactive State Management
export class ReactiveState<T extends Record<string, any>> {
  private state$: BehaviorSubject<T>;
  private actions$ = new Subject<{ type: string; payload: any }>();

  constructor(initialState: T) {
    this.state$ = new BehaviorSubject<T>(initialState);
    
    // Subscribe to actions and update state
    this.actions$.subscribe(action => {
      const currentState = this.state$.value;
      const newState = this.reduce(currentState, action);
      this.state$.next(newState);
    });
  }

  // Override this to implement custom reducers
  protected reduce(state: T, action: { type: string; payload: any }): T {
    return state;
  }

  // Dispatch an action
  dispatch(type: string, payload?: any): void {
    this.actions$.next({ type, payload });
  }

  // Get current state
  getState(): T {
    return this.state$.value;
  }

  // Subscribe to state changes
  subscribe(callback: (state: T) => void): () => void {
    const subscription = this.state$.subscribe(callback);
    return () => subscription.unsubscribe();
  }

  // Select a slice of state
  select<K extends keyof T>(key: K): Observable<T[K]> {
    return this.state$.pipe(
      map(state => state[key]),
      distinctUntilChanged()
    );
  }

  // Select derived state
  selectDerived<R>(selector: (state: T) => R): Observable<R> {
    return this.state$.pipe(
      map(selector),
      distinctUntilChanged()
    );
  }

  // Get observable
  asObservable(): Observable<T> {
    return this.state$.asObservable();
  }
}

// Example: AI System State
export interface AISystemState {
  conversations: any[];
  activeConversationId: number | null;
  isProcessing: boolean;
  geneticAlgorithmRunning: boolean;
  constraintSolverActive: boolean;
  systemMetrics: {
    responseTime: number;
    accuracy: number;
    throughput: number;
  };
  adaptiveParameters: Record<string, number>;
}

export class AISystemReactiveState extends ReactiveState<AISystemState> {
  constructor() {
    super({
      conversations: [],
      activeConversationId: null,
      isProcessing: false,
      geneticAlgorithmRunning: false,
      constraintSolverActive: false,
      systemMetrics: {
        responseTime: 0,
        accuracy: 0,
        throughput: 0,
      },
      adaptiveParameters: {},
    });
  }

  protected reduce(
    state: AISystemState,
    action: { type: string; payload: any }
  ): AISystemState {
    switch (action.type) {
      case 'SET_PROCESSING':
        return { ...state, isProcessing: action.payload };
      
      case 'ADD_CONVERSATION':
        return {
          ...state,
          conversations: [...state.conversations, action.payload],
        };
      
      case 'SET_ACTIVE_CONVERSATION':
        return { ...state, activeConversationId: action.payload };
      
      case 'UPDATE_METRICS':
        return {
          ...state,
          systemMetrics: { ...state.systemMetrics, ...action.payload },
        };
      
      case 'UPDATE_PARAMETERS':
        return {
          ...state,
          adaptiveParameters: { ...state.adaptiveParameters, ...action.payload },
        };
      
      case 'SET_GA_RUNNING':
        return { ...state, geneticAlgorithmRunning: action.payload };
      
      case 'SET_CS_ACTIVE':
        return { ...state, constraintSolverActive: action.payload };
      
      default:
        return state;
    }
  }
}

// Global reactive state instance
export const aiSystemState = new AISystemReactiveState();

// Reactive operators for functional composition
export const reactiveOperators = {
  // Map over stream data
  mapData: <T, R>(mapper: (data: T) => R) =>
    map((event: ReactiveEvent<T>) => ({
      ...event,
      data: mapper(event.data),
    })),

  // Filter by event data
  filterData: <T>(predicate: (data: T) => boolean) =>
    filter((event: ReactiveEvent<T>) => predicate(event.data)),

  // Accumulate events
  accumulate: <T, R>(
    accumulator: (acc: R, event: ReactiveEvent<T>) => R,
    initial: R
  ) =>
    scan(accumulator, initial),

  // Buffer events
  buffer: <T>(bufferSize: number) =>
    scan((acc: ReactiveEvent<T>[], event: ReactiveEvent<T>) => {
      acc.push(event);
      return acc.slice(-bufferSize);
    }, [] as ReactiveEvent<T>[]),
};
