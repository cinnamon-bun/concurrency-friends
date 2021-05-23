/*

A queue of items which are consumed by a single provided handler function,
one item at a time.

Users put items into the queue.  They are run one at a time through the handler,
using `await cb(x)` to make sure only one copy of the handler function runs at a time.
The handler can be an async function (returning a promise) or a sync function.

If you await conveyor.push(x), you will continue after the handler has finished
running on x.  The await will return the return value of the handler function.

It's many-to-one:
Anyone can put items in (fan-in), but only one function processes the data (no fan-out).

Pushing items into the queue is an instant synchronous operation which never blocks.
When pushed, and item won't be processed until queueMicrotask runs, or later.

The queue length is unlimited.

If you provide a sortKeyFn function this becomes a priority queue.  Items in the queue
will be sorted according to sortKeyFn(item), lowest first, while waiting in the queue.

*/

import stable = require('stable');  // stable array sort

import { Deferred, makeDeferred } from './deferred';

// T: type of the items in the queue (input of the handler function)
// R: return type of the handler function

export type ConveyorHandlerFn<T, R> = (item: T) => R | Promise<R>;
export type ConveyorSortKeyFn<T> = (item: T) => any;
type QueueItem<T, R> = {item: T, deferred: Deferred<R> }

export class Conveyor<T, R> {
    _queue: QueueItem<T, R>[] = [];
    _threadIsRunning: boolean = false;
    _handlerFn: ConveyorHandlerFn<T, R>;
    _sortKeyFn: ConveyorSortKeyFn<T> | null;

    constructor(handler: ConveyorHandlerFn<T, R>, sortKeyFn?: ConveyorSortKeyFn<T>) {
        // Create a new Conveyor with a sync or async handler function.
        // If sortKeyFn is provided, this is a priority queue style Conveyor.
        //  sortKeyFn takes a single item and returns the value used to sort it.

        this._handlerFn = handler;
        this._sortKeyFn = sortKeyFn || null;

        // wake up the thread
        queueMicrotask(this._thread.bind(this));
    }

    async push(item: T): Promise<R> {
        // Add an item into the conveyor.
        // After the handler finishes running on this item,
        // this promise will resolve with the return value of the handler,
        // or with an exception thrown by the handler.

        // push item into the queue
        let deferred = makeDeferred<R>();  // this will resolve when the item is done being handled
        this._queue.push({ item, deferred });

        // if this is a priority queue, keep the queue sorted after pushing
        if (this._sortKeyFn !== null) {
            stable.inplace(this._queue, (a: QueueItem<T, R>, b: QueueItem<T, R>): number => {
                // istanbul ignore next
                if (this._sortKeyFn === null) { return 0; }
                let val1 = this._sortKeyFn(a.item);
                let val2 = this._sortKeyFn(b.item);
                if (val1 > val2) { return 1; }
                if (val1 < val2) { return -1; }
                return 0;
            });
        }

        // wake up the thread
        queueMicrotask(this._thread.bind(this));

        return deferred.promise;
    }

    async _thread(): Promise<void> {
        // don't run a second copy of the thread
        if (this._threadIsRunning) { return; }
        this._threadIsRunning = true;

        while (true) {
            if (this._queue.length === 0) {
                // queue is empty; stop thread
                this._threadIsRunning = false;
                return;
            } else {
                // process next item in queue.
                let { item, deferred } = this._queue.shift() as QueueItem<T, R>;
                try {
                    // run the handler function on the item...
                    let result = this._handlerFn(item);
                    if (result instanceof Promise) {
                        result = await result;
                    }
                    // then resolve or reject the promise for whoever added this item to the queue
                    deferred.resolve(result);
                } catch (err) {
                    deferred.reject(err);
                }
            }
        }
    }

}

// TODO: allow the handler to return false to close the conveyor?
// TODO: add close() and closed?
// TODO: send a special parameter to the handler when the queue becomes idle, maybe undefined?
// TODO: rebuild on top of Chan?
