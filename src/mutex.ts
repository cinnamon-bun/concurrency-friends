/*

A mutex is a way to only allow one async function at a time to run.

First, create your mutex:
    let mutex = new Mutex();

Then you can feed it async functions to run.
It will run them one at a time in the same order that mutex.run is called,
waiting for each one to finish before moving on to the next one.
It keeps an internal queue of functions waiting for their turn to run.

    mutex.run(async () => {
        // do some things
        await foo();
        await bar();
    });
    mutex.run(async () => {
        // do more things
        // this function won't begin until the previous one is finished
        // even though in this case we didn't await the mutex.run
        await baz();
    });

You can also provide it with synchronous functions.
Note that functions (async or not) provided to mutex.run won't be started until the next tick or later.

    mutex.run(() => console.log('hello'));

You can await mutex.run to wait until your specific function is done running:

    await mutex.run(async () => {
        // do some things
    });
    // things are now done

*/

import { Conveyor } from './conveyor';

// R: the return type of any function that can go into the mutex

type UserFn<R> = () => R | Promise<R>;

export class Mutex<R> {
    _conveyor: Conveyor<UserFn<R>, R>;
    constructor() {
        // A conveyor full of functions.  At the end of the conveyor, this handler just runs the functions.
        this._conveyor = new Conveyor<UserFn<R>, R>(async userFn => {
            return await userFn();
        });
    }
    async run(userFn: UserFn<R>): Promise<R> {
        // this will resolve when the userFn has finished running
        return await this._conveyor.push(userFn);
    }
}

export class PriorityMutex<R> {
    _conveyor: Conveyor<[number, UserFn<R>], R>;  // pairs of [priority, userFn]
    constructor() {
        // A conveyor full of functions.  At the end of the conveyor, this handler just runs the functions.
        let sortFn = ([priority, userFn]: [number, UserFn<R>]) => priority;
        this._conveyor = new Conveyor<[number, UserFn<R>], R>(async ([priority, userFn]) => {
            return await userFn();
        }, sortFn);
    }
    async run(priority: number, userFn: UserFn<R>): Promise<any> {
        // lower priority goes first
        // this will resolve when the userFn has finished running
        return await this._conveyor.push([priority, userFn]);
    }
}
