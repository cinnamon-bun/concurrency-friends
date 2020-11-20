/*

A queue of items which are consumed by a single provided callback function,
one item at a time.

Users put items into the queue.  They are run one at a time through the callback,
using `await cb(x)` to make sure only one copy of the callback runs at a time.
The callback can be an async function (returning a promise) or a sync function.

If you await conveyor.push(x), you will continue after the callback has finished
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

export type AsyncConveyorCb<T, R> = (item : T) => Promise<R>;
export type SyncConveyorCb<T, R> = (item : T) => R;
export type ConveyorCb<T, R> = AsyncConveyorCb<T, R> | SyncConveyorCb<T, R>;
export type ConveyorSortKeyFn<T> = (item : T) => any;
export type QueueItem<T, R> = [T, (x : R)=>void, ()=>void];  // TODO: add another type variable for return type

export class Conveyor<T, R> {
    queue : QueueItem<T, R>[] = [];  // item, resolve, reject
    cb : ConveyorCb<T, R>;
    sortKeyFn : ConveyorSortKeyFn<T> | null;
    restartThread : (()=>void) | null = null;
    constructor(cb : ConveyorCb<T, R>, sortKeyFn? : ConveyorSortKeyFn<T>) {
        // Create a new Conveyor with a sync or async callback function.
        // The callback should accept one item at a time, or undefined (when the conveyor becomes idle).
        // If sortKeyFn is provided, this is a priority queue.
        // sortKeyFn takes a single item and returns the value used to sort it.
        this.cb = cb;
        this.sortKeyFn = sortKeyFn || null;
        setImmediate(this._thread.bind(this));
    }
    async push(item : T) : Promise<R> {
        // Add an item into the conveyor.
        // This promise will resolve after the callback has finished running on the item.

        // make a promise that we can resolve later, and enqueue the item
        let p = new Promise<R>((resolve, reject) => {
            let queueItem : QueueItem<T, R> = [item, resolve, reject];
            this.queue.push(queueItem);
            // if this is a priority queue, sort the items after pushing the new one
            if (this.sortKeyFn !== null) {
                stable.inplace(this.queue, (a : QueueItem<T, R>, b : QueueItem<T, R>) : number => {
                    // istanbul ignore next
                    if (this.sortKeyFn === null) { return 0; }
                    let val1 = this.sortKeyFn(a[0]);
                    let val2 = this.sortKeyFn(b[0]);
                    if (val1 > val2) { return 1; }
                    if (val1 < val2) { return -1; }
                    return 0;
                });
            }
        });
        // wake up the thread if needed
        if (this.restartThread) { this.restartThread(); }
        return p;
    }
    async _thread() : Promise<void> {
        while (true) {
            if (this.queue.length) {
                // if there are things in the queue, process them
                let [item, resolve, reject] = this.queue.shift() as QueueItem<T, R>;
                resolve(await this.cb(item));  // and release whoever gave us this item
            } else {
                // nothing in the queue, so go to sleep.
                // wake up later when a push calls restartThread().
                await new Promise((resolve, reject) => {
                    this.restartThread = resolve;
                });
            }
        }
    }
}

// TODO:
//     allow the callback to return false to close the conveyor
//     add close() and closed
