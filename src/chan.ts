/*

Channels similar to Go.

A channel of maxLen 0 has no buffer, and gets and puts will each block until there is one of each.
A channel of maxLen N will accept N puts before blocking.
A channel of maxLen null (the default) has an infinite buffer and always accepts puts.

get() and put() can be given an optional timeout value in milliseconds.
If they wait longer than that, they throw a ChannelTimeoutError.

A channel can be closed but not re-opened.
Getting or putting a closed channel will throw a ChannelIsClosedError.
At the moment a channel closes:
    - all buffered items are wiped out
    - all waiting gets and puts throw an error

When get or put calls are waiting, they are queued and processed in the order they were called.
*/

let log = (msg?: any, val?: any) => { };
//let log = console.log;

export class ChannelTimeoutError extends Error {
    constructor(message?: string) {
        super(message || '');
        this.name = 'ChannelTimeoutError';
    }
}
export class ChannelIsClosedError extends Error {
    constructor(message?: string) {
        super(message || '');
        this.name = 'ChannelIsClosedError';
    }
}

export class Chan<T> {
    _maxLen: number | null;
    _buffer: T[];
    _waitingGets: [(val: T) => void, (err: Error) => void][];  //resolve, reject
    _waitingPuts: [T, () => void, (err: Error) => void][];  // val, resolve, reject
    _isClosed: boolean;
    constructor(maxLen: number | null = null) {
        // maxLen = 0: a put will block until a get.
        // maxLen = 1: you can put once before getting.
        // maxLen = null: unlimited buffer size.
        this._maxLen = maxLen;
        this._buffer = [];
        this._waitingGets = [];
        this._waitingPuts = [];
        this._isClosed = false;
    }
    close(): void {
        log('    |   closing channel');
        this._isClosed = true;
        this._buffer = [];
        for (let waitingGet of this._waitingGets) {
            let [resolve, reject] = waitingGet;
            reject(new ChannelIsClosedError("can't get() from a closed channel"));
        }
        for (let [val, resolve, reject] of this._waitingPuts) {
            reject(new ChannelIsClosedError("can't put() to a closed channel"));
        }
        this._waitingGets = [];
        this._waitingPuts = [];
    }
    get isClosed(): boolean {
        return this._isClosed;
    }
    get capacity(): number | null {
        return this._maxLen;
    }
    get length(): number {
        return this._buffer.length;
    }
    get canPutWithoutBlocking(): boolean {
        if (this._isClosed) { return false; }
        if (this._buffer.length === 0 && this._waitingGets.length > 0) { return true; }
        let bufferHasSpace = this._maxLen === null || this._buffer.length < this._maxLen;
        if (bufferHasSpace) { return true; }
        return false;
    }
    get canGetWithoutBlocking(): boolean {
        if (this._isClosed) { return false; }
        return this._buffer.length > 0 || this._waitingPuts.length > 0;
    }
    // TODO: async waitUntilCanGet(), waitUntilCanPut()
    async put(val: T, timeout: number | null = null): Promise<void> {
        log('    |   put', val);

        if (this._isClosed) {
            return Promise.reject(new ChannelIsClosedError("can't put() to a closed channel"));
        }

        let bufferHasSpace = this._maxLen === null || this._buffer.length < this._maxLen;

        // buffer is empty and there's a waiting get: give it to the get
        if (this._buffer.length === 0 && this._waitingGets.length > 0) {
            log('    |   put - give to waiting get');
            let [resolve, reject] = this._waitingGets.shift() as [(val: T) => void, (err: Error) => void];
            resolve(val);
            return;
        }
        // buffer has space: put it in the buffer
        if (bufferHasSpace) {
            log('    |   put - into buffer');
            this._buffer.push(val);
            return;
        }

        // buffer does not have space: enqueue as a waitingPut
        log('    |   put - blocking because buffer has no space and/or nobody is waiting to get');
        let prom = new Promise<void>((resolve, reject) => {
            let waitingPut: [T, () => void, (err: Error) => void] = [val, resolve, reject];
            this._waitingPuts.push(waitingPut);
            // start a race between this setTimeout and someone else coming along to accept the waitingPut
            if (timeout !== null) {
                log('    |   put - blocking ... timeout set, starting race ...');
                if (timeout === 0) {
                    log('    |   put - blocking ... timed out instantly');
                    this._waitingPuts = this._waitingPuts.filter(p => p !== waitingPut);
                    reject(new ChannelTimeoutError('put() timed out'));
                } else {
                    setTimeout(() => {
                        log('    |   put - blocking ... timed out after set timeout');
                        this._waitingPuts = this._waitingPuts.filter(p => p !== waitingPut);
                        reject(new ChannelTimeoutError('put() timed out'));
                    }, timeout);
                }
            }
        });
        return prom;
    }
    async get(timeout: number | null = null): Promise<T> {
        log('    |   get');

        if (this._isClosed) {
            return Promise.reject(new ChannelIsClosedError("can't get() from a closed channel"));
        }

        // buffer has items: grab from buffer
        if (this._buffer.length > 0) {
            log('    |   get - grabbed from buffer');
            return this._buffer.shift() as T;
        }

        // there are waiting puts: grab one
        if (this._waitingPuts.length > 0) {
            log('    |   get - grabbed from waiting put');
            let [val, resolve, reject] = this._waitingPuts.shift() as [T, () => void, (err: Error) => void];
            resolve();
            return val;
        }

        // nothing to get, so become a waitingGet
        log('    |   get - blocking because buffer is empty and nobody is waiting to put');
        let prom = new Promise<T>((resolve, reject) => {
            let waitingGet: [(val: T) => void, (err: Error) => void] = [resolve, reject];
            this._waitingGets.push(waitingGet);
            // start a race between this setTimeout and someone else coming along to resolve the waitingGet
            if (timeout !== null) {
                log('    |   get - blocking ... timed out');
                if (timeout === 0) {
                    this._waitingGets = this._waitingGets.filter(x => x !== waitingGet);
                    reject(new ChannelTimeoutError('get() timed out'));
                } else {
                    setTimeout(() => {
                        this._waitingGets = this._waitingGets.filter(x => x !== waitingGet);
                        reject(new ChannelTimeoutError('get() timed out'));
                    }, timeout);
                }
            }
        });
        return prom;
    }
    async forEach(fn: (item: T) => void, timeout: number | null = null): Promise<void> {
        // pull items from the channel and run fn(item).
        // if timeout is null, this will block forever or until the channel is closed.
        // it's possible that a lot of fn(item)s could get run in parallel, so watch out.
        // each pull will have the given timeout.
        // you can await the overall forEach - it will proceed when the channel is closed or a timeout occurs.
        while (true) {
            let item: T;
            try {
                item = await this.get(timeout);
            } catch (e) {
                return;
            }
            fn(item);
        }
    }
    async forEachAwait(fn: (item: T) => Promise<void>, timeout: number | null = null): Promise<void> {
        // same as forEach except it does "await fn(item)".
        // ensures that only one copy of fn is running at a time.
        while (true) {
            let item: T;
            try {
                item = await this.get(timeout);
            } catch (e) {
                return;
            }
            await fn(item);
        }
    }
}
