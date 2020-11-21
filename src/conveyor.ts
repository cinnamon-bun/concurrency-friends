/*

A queue of items which are consumed by a single provided handler function,
one item at a time.

Users put items into the queue.  They are run one at a time through the handler,
using `await cb(x)` to make sure only one copy of the handler runs at a time.
The handler can be an async function (returning a promise) or a sync function.

If you await conveyor.push(x), you will continue after the handler has finished
running on x.

It's many-to-one:
Anyone can put items in (fan-in), but only one function processes the data (no fan-out).

Pushing items into the queue is an instant synchronous operation which never blocks.
The queue items will be processed in the next tick.

The queue length is unlimited.

If you provide a sortKeyFn function this becomes a priority queue.  Items in the queue
will be sorted according to sortKeyFn(item), lowest first, while waiting in the queue.

*/

import stable = require('stable');  // stable array sort

// T: input type of the handler function
// R: return type of the handler

export type ConveyorCb<T, R> = (item: T) => R | Promise<R>;
export type ConveyorSortKeyFn<T> = (item: T) => any;

type QueueItem<T, R> = [T, (x: R) => void, (err: any) => void];  // [item, resolve, reject]
type Thunk = () => void;

export class Conveyor<T, R> {
    _queue: QueueItem<T, R>[] = [];  // item, resolve, reject
    _handler: ConveyorCb<T, R>;
    _sortKeyFn: ConveyorSortKeyFn<T> | null;
    _wakeUpThread: Thunk | null = null;  // this is a promise resolve fn to let the thread continue running

    constructor(handler: ConveyorCb<T, R>, sortKeyFn?: ConveyorSortKeyFn<T>) {
        // Create a new Conveyor with a sync or async handler function.
        // The handler should accept one item at a time, or undefined (when the conveyor becomes idle).
        // If sortKeyFn is provided, this is a priority queue.
        // sortKeyFn takes a single item and returns the value used to sort it.

        this._handler = handler;
        this._sortKeyFn = sortKeyFn || null;

        // start the processing thread
        setImmediate(this._thread.bind(this));
    }

    async push(item: T): Promise<R> {
        // Add an item into the conveyor.
        // After the handler finishes running on this item,
        // this promise will resolve with the return value of the handler,
        // or with an exception thrown by the handler.

        // make a promise that we can resolve later, and enqueue the item
        let prom = new Promise<R>((resolve, reject) => {
            let queueItem: QueueItem<T, R> = [item, resolve, reject];
            this._queue.push(queueItem);
            // if this is a priority queue, sort the items after pushing the new one
            if (this._sortKeyFn !== null) {
                stable.inplace(this._queue, (a: QueueItem<T, R>, b: QueueItem<T, R>): number => {
                    // istanbul ignore next
                    if (this._sortKeyFn === null) { return 0; }
                    let val1 = this._sortKeyFn(a[0]);
                    let val2 = this._sortKeyFn(b[0]);
                    if (val1 > val2) { return 1; }
                    if (val1 < val2) { return -1; }
                    return 0;
                });
            }
        });

        // wake up the thread if needed
        if (this._wakeUpThread) {
            this._wakeUpThread();
            this._wakeUpThread = null;
        }

        return prom;
    }

    async _thread(): Promise<void> {
        while (true) {
            if (this._queue.length > 0) {
                // if there are things in the queue, process them
                let [item, resolve, reject] = this._queue.shift() as QueueItem<T, R>;
                try {
                    // actually run the handler
                    let result = await this._handler(item);
                    resolve(result);  // release whoever gave us this item
                } catch (err) {
                    reject(err);  // hand the error back to whoever gave us this item
                }
            } else {
                // nothing in the queue, so go to sleep by awaiting a promise that
                // we'll resolve later when a push happens.
                await new Promise((resolve, reject) => {
                    this._wakeUpThread = resolve;
                });
            }
        }
    }
}

// TODO:
//     allow the handler to return false to close the conveyor
//     add close() and closed
