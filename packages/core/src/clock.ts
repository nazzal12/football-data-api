export interface Clock {
  now(): Date;
  nowMs(): number;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }

  nowMs(): number {
    return Date.now();
  }
}

export class FrozenClock implements Clock {
  private current: number;

  constructor(isoOrMs: string | number | Date) {
    if (typeof isoOrMs === "number") {
      this.current = isoOrMs;
    } else if (isoOrMs instanceof Date) {
      this.current = isoOrMs.getTime();
    } else {
      this.current = Date.parse(isoOrMs);
    }
  }

  now(): Date {
    return new Date(this.current);
  }

  nowMs(): number {
    return this.current;
  }

  advance(ms: number): void {
    this.current += ms;
  }

  set(isoOrMs: string | number | Date): void {
    if (typeof isoOrMs === "number") {
      this.current = isoOrMs;
    } else if (isoOrMs instanceof Date) {
      this.current = isoOrMs.getTime();
    } else {
      this.current = Date.parse(isoOrMs);
    }
  }
}
