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

import LinkedList, { Node as LinkedListNode } from 'dbly-linked-list';

import { Deferred, makeDeferred } from './deferred';

export let removeLinkedListNode = (list: LinkedList, node: LinkedListNode) => {
    if (node.next && node.prev) {
        node.next.prev = node.prev;
        node.prev.next = node.next;
        list.size -= 1;
    } else if (node.next) {
        // this is the first node
        let newFirst = node.next;
        newFirst.prev = null;
        list.head = newFirst;
        list.size -= 1;
    } else if (node.prev) {
        let newLast = node.prev;
        newLast.next = null;
        list.tail = newLast;
        list.size -= 1;
    } else {
        // this is the only node
        list.clear();
    }
    node.next = null;
    node.prev = null;
}


let J = (x: any) => JSON.stringify(x);
let log = (msg?: any, val?: any) => { };
//let log = console.log;

export class ChannelTimeoutError extends Error {
    constructor(message?: string) {
        /* istanbul ignore next */
        super(message || '');
        this.name = 'ChannelTimeoutError';
    }
}
export class ChannelIsClosedError extends Error {
    constructor(message?: string) {
        /* istanbul ignore next */
        super(message || '');
        this.name = 'ChannelIsClosedError';
    }
}
export class ChannelIsSealedError extends Error {
    constructor(message?: string) {
        /* istanbul ignore next */
        super(message || '');
        this.name = 'ChannelIsSealedError';
    }
}

type Thunk = () => void;
type BusCb<T> = (msg: T) => any;
class Bus<T> {
    cbs: Set<BusCb<T>> = new Set();
    constructor() {
    }
    subscribe(cb: BusCb<T>): Thunk {
        this.cbs.add(cb);
        return () => this.cbs.delete(cb);
    }
    send(msg: T): void {
        for (let cb of this.cbs) {
            cb(msg);
        }
    }
}

interface WaitingPut<T> {
    item: T,
    deferred: Deferred<void>;
};
export class Chan<T> {
    _queue: LinkedList; // of T
    _capacity: number | null;
    _isClosed: boolean = false;
    _isSealed: boolean = false;
    _waitingGets: LinkedList;  // of Deferred<T>
    _waitingPuts: LinkedList;  // of WaitingPut<T>

    onClose: Bus<void> = new Bus();
    onSeal: Bus<void> = new Bus();

    // TODO: add events for:
    //   closed (manually, or because sealed-and-drained)
    //   sealed
    //   idle (empty, nothing waiting)
    //   waiting gets (pull pressure)
    //   waiting puts (push pressure)

    constructor(capacity: number | null = null) {
        log(`constructor(capacity = ${capacity})`);
        // maxLen = 0: a put will block until a get.
        // maxLen = 1: you can put once before getting.
        // maxLen = null: unlimited buffer size.
        this._capacity = capacity;
        this._queue = new LinkedList();
        this._waitingGets = new LinkedList();
        this._waitingPuts = new LinkedList();
    }

    close(): void {
        if (this._isClosed) { return; }

        // ok to close if sealsed

        log(`close...`);
        this._isClosed = true;

        // throw away queue
        this._queue = new LinkedList();

        // reject waiting gets
        log(`...reject waiting gets`);
        this._waitingGets.forEach((node: LinkedListNode) => {
            let waitingGet = node.getData() as Deferred<T>;
            waitingGet.reject(new ChannelIsClosedError('waiting get is cancelled because channel was closed'));
        });
        this._waitingGets = new LinkedList();

        // reject waiting puts
        this._waitingPuts.forEach((node: LinkedListNode) => {
            let waitingPut = node.getData() as WaitingPut<T>;
            waitingPut.deferred.reject(new ChannelIsClosedError('waiting get is cancelled because channel was closed'));
        });
        this._waitingPuts = new LinkedList();

        log(`...sending onClose`);
        this.onClose.send();  // we should await here, but we can't because we're in a sync function

        // remove all event subscriptions
        this.onClose.cbs.clear();
        this.onSeal.cbs.clear();

        log(`...close is done.`);
    }
    get isClosed(): boolean {
        return this._isClosed;
    }

    seal(): void {
        // This is equivalent to adding a special "end" value into the queue,
        //  but we do it just by marking the queue as sealed.
        // Once sealed, you can't put() or it throws a Sealed error.
        // get() will succeed until the existing items are drained,
        //  after which the queue will be closed for you and further get()s
        //  will throw a Closed error.

        if (this._isSealed) { return; }

        // ok to seal if closed?  no point in it, but no harm either

        log(`seal...`);
        this._isSealed = true;

        // when we seal, any waiting things should be rejected.
        // waiting gets mean the queue is empty so it is about to be auto-closed
        // waiting puts mean the queue is full and will never accept any more puts
        // only the items in the queue are left alone, if there are any.

        // reject waiting gets
        log(`...reject waiting gets`);
        this._waitingGets.forEach((node: LinkedListNode) => {
            let waitingGet = node.getData() as Deferred<T>;
            waitingGet.reject(new ChannelIsSealedError('waiting get is cancelled because channel was sealed'));
        });
        this._waitingGets = new LinkedList();

        // reject waiting puts
        log(`...reject waiting puts`);
        this._waitingPuts.forEach((node: LinkedListNode) => {
            let waitingPut = node.getData() as WaitingPut<T>;
            waitingPut.deferred.reject(new ChannelIsSealedError('waiting put is cancelled because channel was sealed'));
        });
        this._waitingPuts = new LinkedList();

        log('...sending onSeal');
        this.onSeal.send();  // we should await here, but we can't because we're in a sync function

        if (this._queue.isEmpty()) {
            log(`...nothing is in the queue; closing the channel right now`);
            this.close();
        }

        log(`...seal is done.`);
    }
    get isSealed(): boolean {
        return this._isSealed;
    }

    get capacity(): number | null {
        return this._capacity;
    }
    get itemsInQueue(): number {
        return this._queue.getSize();
    }
    get itemsInQueueAndWaitingPuts(): number {
        return this._queue.getSize() + this._waitingPuts.getSize();
    }
    get numWaitingGets(): number {
        return this._waitingGets.getSize();
    }
    get isIdle(): boolean {
        return this._queue.getSize() + this._waitingGets.getSize() + this._waitingPuts.getSize() === 0;
    }

    get canImmediatelyPut(): boolean {
        if (this._isClosed || this.isSealed) {
            log('canImmediatelyPut: no, because closed or sealed');
            return false;
        }
        // A. queue is empty and there's a waiting get: give it to the get
        if (this._queue.isEmpty() && !this._waitingGets.isEmpty()) {
            log('canImmediatelyPut: A. yes, queue is empty and there is a waiting get');
            return true;
        }
        // B. queue has space: put it in the queue
        let queueHasSpace = this._capacity === null || (this._queue.getSize() < this._capacity);
        if (queueHasSpace) {
            log('canImmediatelyPut: B. yes, queue has space');
            return true;
        }
        // C. queue does not have space: enqueue as a waitingPut
        log('canImmediatelyPut: C. no, queue has no space and there are no waiting gets');
        return false;
    }

    get canImmediatelyGet(): boolean {
        if (this._isClosed) { return false; }
        // A. queue has items: grab from queue
        if (!this._queue.isEmpty()) { return true; }
        // B. there are waiting puts: grab one
        if (!this._waitingPuts.isEmpty()) { return true; }
        // C. nothing to get
        return false;
    }

    async put(item: T, opts?: { timeout: number | null }): Promise<void> {
        // can throw ChannelIsClosedError, ChannelIsSealedError, ChannelTimeoutError

        log(`put(${J(item)}, ${J(opts)})...`);

        // sealed error takes precendence
        if (this._isSealed) { throw new ChannelIsSealedError('cannot put() to a sealed channel'); }
        if (this._isClosed) { throw new ChannelIsClosedError('cannot put() to a closed channel'); }

        let queueHasSpace = this._capacity === null || (this._queue.getSize() < this._capacity);

        // A. queue is empty and there's a waiting get: give it to the get
        if (this._queue.isEmpty() && !this._waitingGets.isEmpty()) {
            log(`...put: A. give it to a waiting get`);
            let getDeferred = this._waitingGets.getHeadNode()?.getData() as Deferred<T>;
            this._waitingGets.removeFirst();
            getDeferred.resolve(item);
            log(`...put is done.`);
            return;
        }

        // B. queue has space: put it in the queue
        if (queueHasSpace) {
            log(`...put: B. put it in the queue`);
            this._queue.insert(item as any);
            log(`...put is done.`);
            return;
        }

        // C. queue does not have space

        // C2. timeout is zero so just throw Timeout error right now
        let opts2 = opts ?? { timeout: null };
        let timeout = opts2.timeout;
        if (timeout === 0) {
            log(`...put: C3. queue is full and timeout is zero, so throw timeout error right away`);
            log(`...put is done.`);
            throw new ChannelTimeoutError('queue is full and timeout is zero');
        }

        // C3. enqueue as a waitingPut
        // (we've already checked that the channel is not sealed)
        log(`...put: C3. no space, make a waitingPut that will block`);
        let putDeferred = makeDeferred<void>();
        let waitingPut = { item, deferred: putDeferred };
        this._waitingPuts.insert(waitingPut);
        let waitingPutNode = this._waitingPuts.getTailNode() as LinkedListNode;

        // if timeout is desired, start a timer
        if (timeout !== null && timeout > 0) {
            log(`...put: C3t. starting a timer to cancel the put in ${timeout} ms`);
            let timer = setTimeout(() => {
                // If timer happens, remove the waitingPut.
                // This is harmless if it happens to occur after the
                //  waitingPut succeeds.
                log(`...put: C3t. timeout timer has fired after ${timeout} ms`);
                removeLinkedListNode(this._waitingPuts, waitingPutNode);
                putDeferred.reject(new ChannelTimeoutError('timeout occurred'));
            }, timeout);
            // If the waitingPut is resolved later, cancel the timer.
            putDeferred.promise
                .then(() => {
                    log(`...put: C3t. put succeeded, so cancelling the timeout timer`);
                    clearTimeout(timer);
                })
                // If our promise is rejected, we have to catch it here too
                // to avoid unhandled promise rejection.
                // (every then() must have a following catch())
                .catch(() => {});
        }

        log(`...put is done.`);
        return putDeferred.promise;
    }

    async get(opts?: { timeout: number | null }): Promise<T> {
        log(`get(${J(opts)})...`);

        // can throw ChannelIsClosedError, ChannelTimeoutError
        // (when a channel is sealed and eventually becomes empty, it closes itself.)
        // (then, getting from it when it's empty will throw a Sealed error.)
        if (this._isClosed) {
            // sealed error takes precedence
            if (this._isSealed) {
                throw new ChannelIsSealedError('cannot get() from a sealed channel');
            } else {
                throw new ChannelIsClosedError('cannot get() from a closed channel');
            }
        }

        // A. queue has items: grab from queue
        if (!this._queue.isEmpty()) {
            log(`...get: A. get item from queue.`);
            let item = this._queue.getHeadNode()?.getData() as T;
            this._queue.removeFirst();

            // if sealed and just became empty, close it
            if (this._isSealed && this._queue.isEmpty()) {
                log(`...get: A1. channel is sealed and we just got the last item; closing it`);
                this.close();
            }

            // if there are waiting puts, get the next one and put it into the queue
            // to keep the queue full
            if (!this._waitingPuts.isEmpty() && this._capacity !== null && this._queue.getSize() < this._capacity) {
                log(`...get: A2. now there is space in the queue; getting a waiting put to fill the space`);
                let waitingPut = this._waitingPuts.getHeadNode()?.getData() as WaitingPut<T>;
                this._waitingPuts.removeFirst();
                let { item, deferred } = waitingPut;
                this._queue.insert(item as any);
                // resolve the waitingPut promise
                deferred.resolve(undefined);
            }

            log(`...get is done.`);
            return item;
        }

        // B. queue is empty but there are waiting puts: grab one directly
        // (this happens when queue capacity is zero)
        if (!this._waitingPuts.isEmpty()) {
            log(`...get: B. get item from a waiting put and resolve the waiting put`);
            let waitingPut = this._waitingPuts.getHeadNode()?.getData() as WaitingPut<T>;
            this._waitingPuts.removeFirst();
            let { item, deferred } = waitingPut;
            // resolve the waiting promise
            deferred.resolve(undefined);
            log(`...get is done.`);
            return item;
        }

        // C. nothing to get

        // C2. timeout is zero so just throw Timeout error right now
        let opts2 = opts ?? { timeout: null };
        let timeout = opts2.timeout;
        if (timeout === 0) {
            log(`...get: C2. nothing to get and timeout is zero, so throw timeout error right away`);
            log(`...get is done.`);
            throw new ChannelTimeoutError('nothing to get and timeout is zero');
        }

        // C3. make a waiting get
        log(`...get: C3. nothing to get; making a waiting get to block on`);
        let getDeferred = makeDeferred<T>();
        this._waitingGets.insert(getDeferred);
        let waitingGetNode = this._waitingGets.getTailNode() as LinkedListNode;

        // if timeout is desired, start a timer
        if (timeout !== null && timeout > 0) {
            log(`...get: C3t. starting a timer to cancel the get in ${timeout} ms`);
            let timer = setTimeout(() => {
                // If timer happens, remove the waitingGet.
                // This is harmless if it happens to occur after the
                //  waitingGet succeeds.
                log(`...get: C3t. timeout timer has fired after ${timeout} ms`);
                removeLinkedListNode(this._waitingGets, waitingGetNode);
                getDeferred.reject(new ChannelTimeoutError('timeout occurred'));
            }, timeout);
            // If the waitingGet is resolved later, cancel the timer.
            getDeferred.promise
                .then(() => {
                    log(`...get: C3t. get succeeded, so cancelling the timeout timer`);
                    clearTimeout(timer);
                })
                // If our promise is rejected, we have to catch it here too
                // to avoid unhandled promise rejection.
                // (every then() must have a following catch())
                .catch(() => {});
        }

        log(`...get is done.`);
        return getDeferred.promise;
    }

    async forEach(cb: (item: T) => any | Promise<any>, opts?: { timeout: number | null }): Promise<void> {
        // pull items from the channel and run cb(item) on each one.
        // block until the channel is closed or sealed-and-drained, or timeout occurs while reading.
        // if cb throws an error, it will propagate upwards and stop the forEach loop.
        //
        // if you want to stop when the queue becomes empty, set timeout: 0.
        while (true) {
            let item: T;
            try {
                item = await this.get(opts);
            } catch (err) {
                // stop if the get fails
                if (err instanceof ChannelIsClosedError) { return; }
                if (err instanceof ChannelIsSealedError) { return; }
                /* istanbul ignore else */
                if (err instanceof ChannelTimeoutError) { return; }
                /* istanbul ignore next */
                throw err;  // should never get here
            }
            // run the callback.
            // if this throws an error, don't catch it; let it propagate upwards
            let keepRunning = await cb(item);
            // stop if the callback returns false
            if (keepRunning === false) {
                return;
            }
        }
    }

}