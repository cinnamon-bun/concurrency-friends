/*

A lock is a way to only allow one function to run at a time

First, create your lock:
    let lock = new Lock();

Then you can feed it functions to run (sync or async).
It will run them one at a time in the same order that lock.run is called,
waiting for each one to finish before moving on to the next one.
It keeps an internal queue of functions waiting for their turn to run.

    lock.run(async () => {
        // do some things
        await foo();
        await bar();
    });
    lock.run(async () => {
        // do more things
        // this function won't begin until the previous one is finished
        // even though in this case we didn't await the lock.run call
        await baz();
    });
    lock.run(() => {
        // synchronous functions also work
        console.log('hello')
    });

You can await lock.run to wait until your specific function is done running,
and you'll get back the return value of your function:

    let val = await lock.run(async () => {
        // do some things
        return 123;
    });
    // things are now done
    // val is 123

Note that functions provided to lock.run won't be started until the next microtask.

*/

import { Conveyor } from './conveyor';

// R: the return type of any function that can go into the lock

type FnToRun<R> = () => R | Promise<R>;

export class Lock<R> {
    _conveyor: Conveyor<FnToRun<R>, R>;
    constructor() {
        // A conveyor full of functions, to run one at a time.
        // At the end of the conveyor, this handler just runs the functions.
        let handlerFn = async (fnToRun: FnToRun<R>) => {
            let result = fnToRun();
            if (result instanceof Promise) { result = await result; }
            return result;
        };
        this._conveyor = new Conveyor<FnToRun<R>, R>(handlerFn);
    }
    async run(fnToRun: FnToRun<R>): Promise<R> {
        // This will resolve when the fnToRun has finished running.
        return await this._conveyor.push(fnToRun);
    }
}

type FnAndPriority<R> = { priority: number, fnToRun: FnToRun<R> };
export class PriorityLock<R> {
    _conveyor: Conveyor<FnAndPriority<R>, R>;
    constructor() {
        // A conveyor full of functions, to run one at a time.
        // At the end of the conveyor, this handler just runs the functions.
        let sortFn = (item: FnAndPriority<R>): number => item.priority;
        let handlerFn = async (item: FnAndPriority<R>) => {
            let result = item.fnToRun();
            if (result instanceof Promise) { result = await result; }
            return result;
        };
        this._conveyor = new Conveyor<FnAndPriority<R>, R>(handlerFn, sortFn);
    }
    async run(priority: number, fnToRun: FnToRun<R>): Promise<any> {
        // Lower priority goes first.
        // This will resolve when the fnToRun has finished running.
        return await this._conveyor.push({ priority, fnToRun });
    }
}
