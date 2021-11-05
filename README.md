# Concurrency friends

3 helpful tools for concurrency.  They are similar but are designed for different use cases.

Status: tested, working, but not production ready.

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Contents**

- [Install](#install)
- [Overview](#overview)
  - [Chan](#chan)
  - [Conveyor](#conveyor)
  - [Lock](#lock)
- [Chan in detail](#chan-in-detail)
  - [Chan API](#chan-api)
    - [Constructor](#constructor)
    - [Capacity zero?](#capacity-zero)
    - [Put](#put)
    - [Put with timeout](#put-with-timeout)
    - [Get](#get)
    - [Get with timeout](#get-with-timeout)
    - [Close, isClosed](#close-isclosed)
    - [Seal, isSealed](#seal-issealed)
    - [ForEach](#foreach)
    - [Events: `onClose` and `onSeal`](#events-onclose-and-onseal)
    - [Misc other information](#misc-other-information)
  - [Chan in depth](#chan-in-depth)
    - [Comparison with streams](#comparison-with-streams)
    - [More details](#more-details)
- [Conveyor in detail](#conveyor-in-detail)
- [Lock in detail](#lock-in-detail)
  - [Example](#example)
  - [Lock API](#lock-api)
    - [Constructor](#constructor-1)
    - [Run](#run)
  - [Return values and function parameters](#return-values-and-function-parameters)
  - [Errors](#errors)
  - [Priority](#priority)
  - [Bypass](#bypass)
  - [Deadlock](#deadlock)
  - [Using several locks safely](#using-several-locks-safely)
- [Other stuff](#other-stuff)
  - [Deferred](#deferred)
- [Develop](#develop)
  - [File dependency chart](#file-dependency-chart)
  - [Updating the README table of contents](#updating-the-readme-table-of-contents)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

# Install

`npm install concurrency-friends`

or

`yarn add concurrency-friends`

# Overview

## Chan

```
put(item)-->   item  item      item    get()--> item
              ---> ---> ---> ---> --->
                     the queue         
```

A message queue, like in the Go language.  Put items in, get items out in the same order.  The queue can be of limited length (even zero) or unlimited length.

Use a Chan to move items between different "threads" in your code (e.g. different async functions running at the same time)

Multiple threads can put items into a Chan.  Multiple threads can consume them too; each item will go to one specific thread (it's not broadcast to all consumers; this doesn't act like an Event).

If you only have one consumer thread, this is a way to enforce that your items are put into a single-file line and consumed one at a time.

## Conveyor

```
push(item)-->   item   item  item      item        handlerFn(item)
               ---> ---> ---> ---> ---> ---> --->
```

Each `Conveyor` has one, fixed handler function at the end of a queue.

Put your items in the queue.  The handler function eats them in order, **one at a time**.

Use a Conveyor when you want to process items one at a time, and you want to know when a specific item has finished processing.

**Comparison: Blocking**

* Chan: `await put(item)` blocks until the item is ***removed*** from the queue
* Conveyor: `await push(item)` blocks until the item has been removed and ***the handler function is done running***.

**Comparison: Number of consumers**

* Chan: as many consumers as you like; you pull items yourself using `get`
* Conveyor: one consumer function that's run for you, you just provide the function

**How to use**

`await conveyor.push(item)` will add the item to the queue and continues when the handler function is done running on that specific item.  It returns the output of the handler function.

Conveyors can also act as priority queues, bumping some items to the front of the queue.

## Lock
```
run(fn)-->   fn    fn    fn     fn             call the fn
            ---> ---> ---> ---> ---> ---> --->
```

Use a Lock when you have a variety of long-running functions that should only be allowed to run one at a time, not overlapping in time.

Put *functions* in.  They are run in order, **one at a time** -- even if they are slow async functions.

`await lock.run(fn)` will continue when that specific function has been called and is done running.


The `PriorityLock` class is built on a priority queue.  You call `await lock.run(priority, fn)` and functions with lower priorities run first, when there are several waiting.

# Chan in detail

## Chan API

---

### Constructor

You set the maximum size of the queue (its "capacity") in the constructor.  This can be any integer >= 0, or `null` for unlimited length.

You also have to tell Typescript what type of object will be passing through the Chan.

```ts
constructor(capacity: number | null = null);
```

```ts
let chanCapacity3 = new Chan<string>(3);

// default capacity is null (unlimited)
let chanUnlimited = new Chan<string>();

let chanOfNumbersAndNulls = new Chan<number | null>();
```

### Capacity zero?

When capacity is 0, the queue is not used.  Instead, attempts to `put` and `get` will wait around until there's one of each, and then the item will be handed off directly from one to the other.

This is a good choice if you have a pipeline of several Chans in a row and you don't want any "buffer bloat" of items building up between them.

### Put

Add an item to the queue.

`await chan.put(item)` waits until the queue has space for an extra item, then adds it and returns.  If this succeeds and the the promise resolves without error, the item made it into the queue.

This can throw the following exceptions:
* `ChannelTimeoutError` -- if a timeout is specified (see below) and it happens.
* `ChannelIsClosedError` -- when putting to a Chan that's been `close`d.
* `ChannelIsSealedError`  -- when putting to a Chan that's been `seal`ed.

### Put with timeout

`await chan.put(item, { timeout: number | null })`

Try to put an item, but if there's no room for it within the given number of milliseconds, throw a `ChannelTimeoutError`.

`null` means no timeout, and is the default.

> **Remember to `await`**
> 
> `chan.put(item)` adds an item and returns immediately  If the queue is full, your item is in limbo until it eventually finds room in the queue, but it can be lost if the Chan is `seal`ed.  This is usually not what you want; use `await` instead.

---

### Get

Get an item from the queue.

`await chan.get()` gets the next item and removes it from the queue.  If the queue is empty, this waits for an item to appear.

This can throw the following exceptions:
* `ChannelTimeoutError` -- if a timeout is specified (see below) and it happens.
* `ChannelIsClosedError` -- when getting from a Chan that's been `close`d.
* `ChannelIsSealedError`  -- when getting from a Chan that's been `seal`ed and is empty.  (You can `get` existing items out of a `seal`ed Chan.)

### Get with timeout

`await chan.get({ timeout: number | null })`

Try to get an item, but if there are none to get within the given number of milliseconds, throw a `ChannelTimeoutError`.

---

### Close, isClosed

`chan.close()`

Close a Chan.

Use this when you're done with a chan and you want to do a hard shutdown of whatever is happening on the other side of it.

Attempts to `get` or `put` will fail with a `ChannelIsClosedError`.

A closed Chan immediately discards all items from its queue.  All waiting promises (gets or puts) will immediately reject with a `ChannelIsClosedError`.

A closed Chan cannot be opened again.

`chan.isClosed` -- a read-only property that's true or false: is a Chan closed?

---

### Seal, isSealed

`chan.seal()`

Seal a Chan.  This caps the input side of the queue so that no new items can be `put`, but existing items can still be obtained with `get`.

Once the queue becomes empty, it will be `close()`d for you.  If you seal a chan that's already empty, it will be closed right away.  Otherwise it will close after the last item has been pulled out.

Use this when you're done adding items to a Chan and want to signal that the data is complete, and you want to gently give consumers a chance to finish getting all the items out.

Trying to `put` into a sealed Chan will throw a `ChannelIsSealedError`.

Trying to `get` from sealed Chan will work until the queue is empty, then it will throw a `ChannelIsSealedError`.

A Chan remains "sealed" after it gets automatically "closed"; it's both at the same time.  When it's both, it emits `ChannelIsSealedError`s instead of `ChannelIsClosedError`s to remind you that it was closed because it was sealed, not closed in anger.

A sealed Chan cannot be un-sealed again.

`chan.isSealed` -- a read-only property that's true or false: is a Chan sealed?

---

### ForEach

Run a callback function on each item in the Chan.  This is similar to "subscribing" to the items in the Chan.

The call to forEach will block until a stopping condition is met, which is potentially forever.

The stopping conditions are any exception thrown by `get`: a timeout, the channel was closed, or the channel was sealed and ran out of items.

```ts
async forEach(
    cb: (item: T) => any | Promise<any>,
    opts?: { timeout: number | null }
): Promise<void>;
```

Examples:

```ts
await chan.forEach(item => console.log(item));

await chan.forEach(async (item) => {
    // you can use an async callback here too
    await sleep(1000);
    console.log(item);
});

// timeout options
await chan.forEach(item => {
    console.log(item)
}, { timeout: 100 });
```

Your callback can be an async function.  The callback will be run in series, one at a time, each call waiting for the previous one to finish.

To understand `timeout`, know that internally this is just doing `await get({ timeout: yourTimeoutSetting })` in a loop.  So for every item that it tries to get, it starts a fresh timeout counter.  Once it has waited that long to get the next item, it will give up and stop the whole loop.

If you set `timeout: 0`, it will give up without waiting when the queue becomes empty.  This is a way to drain the existing items in the queue without waiting for more.

**Error handling**

If your callback throws an error, it will propagate upwards to the `forEach` call.  Hopefully you put the `await forEach` call in a try...catch block.

If the loop gets a Chan error of any kind while trying to `get`, it will swallow that error and just end the loop.

**Stopping a forEach**

There are several ways to stop a `forEach` loop:

* Return `false` from your callback.
* Throw an error from your callback.
* Close the channel.  This will work immediately and items waiting in the queue will be discarded.
* Seal the channel and wait for the loop to finish consuming the existing items.
* If the `forEach` has a timeout, starve it of new items for that length of time and it will stop.

To stop the loop from the outside, without closing the channel, you could instead provide a variable that the loop watches:

```ts
// a way to stop a forEach from outside

let loopControl = { keepRunning: true }

// not using "await forEach" in this example, but usually you should
chan.forEach(item => {
    console.log(item);

    // returning false will stop the loop
    return loopControl.keepRunning;
});

// later, set keepRunning to false, and the loop will end
setTimeout(() => {
    loopControl.keepRunning = false;
}, 1000);
```

---

### Events: `onClose` and `onSeal`

A chan emits events when it's sealed and when it's closed.

To subscribe to an event:

```ts
chan.onClose.subscribe( /* handler function */ );
chan.onSeal.subscribe( /* handler function */ );
```

The handler functions take no inputs, and are run as synchronous functions (without awaiting them).

For example:

```ts
let unsub = chan.onClose.subscribe(() => {
    // ... your handler here ...
});
unsub();  // unsubscribe
```

`subscribe(...)` returns another function which will remove the subscription.

The `onClose` event is sent after the closing process is complete; by that point the chan has `chan.isClosed === true`.

The `onSeal` event is sent after the sealing process is complete.

---

### Misc other information

These are all read-only properties.

`chan.capacity: number | null`
-- The max size of the queue.  Null means unlimited size.

`chan.itemsInQueue: number`
-- Number of items in the queue.

`chan.itemsInQueueAndWaitingPuts: number`
-- Number of items in the queue plus the number of waiting `put()` attempts that are stuck until there's room in the queue.  If you try to `get` everything, you'll get up to this number of items.  (The waiting puts might be cancelled by a timeout before you `get` them.)

`chan.numWaitingGets: number`
-- Number of consumers who are stuck waiting to `get` an item from the Chan.

`chan.isIdle: boolean`
-- The Chan is "idle" when the queue is empty and nobody is waiting to `put` or `get` anything.

`chan.canImmediatelyPut: boolean`
-- If you try to `put` right now, will you succeed without waiting?  E.g. there's room in the queue, or someone is waiting to `get` something right now, and the Chan is not sealed or closed.

`chan.canImmediatelyGet: boolean`
-- If you try to `get` right now, will you succeed without waiting?  E.g. there's an item in the queue, or someone is waiting to `put` something right now, and the Chan is not closed.

---

## Chan in depth

A `Chan` is a queue of items.  You add items with `put(item)`, and get them with `get()`.  They come out in the same order they went in.

A Chan is meant to be used by two different "threads" (e.g. asynchronous functions) to coordinate sending data between them.

### Comparison with streams

Streams are a **declarative** way to structure a flow of items.  They can be hard to understand because you have to know what each stream operator does, but the code is very compact:

```ts
// hypothetical stream example
// pretend this is RxJS or something
let source1 = Stream.from([1,2,3,4,5]);
let source2 = Stream.from([10,20,30,40,50]);
let zippedFirstThree = zip(source1, source2).take(3)

// output: [1, 10], [2, 20], [3, 30]
```

Chans are an **imperative** way to handle a flow of items.  They result in longer code but it can be easier to understand - it's just a bunch of loops.

```ts
// equivalent example using Chans

// we'll have a pipeline of Chans, and some
// threads that move things along between them.

let chan1 = new Chan<number>()
let chan2 = new Chan<number>()
let zippedChan = new Chan<number>()
let firstThree = new Chan<number>()

// we'll launch a bunch of "threads" (independently running
// async functions) to run in parallel.

// thread to fill chan 1
setTimeout(() => {
    for (let num of [1,2,3,4,5]) {
        await chan1.put(num);
    }
    chan1.seal();
}, 0);

// thread to fill chan 2
setTimeout(() => {
    for (let num of [10,20,30,40,50]) {
        await chan2.put(num);
    }
    chan2.seal();
}, 0);

// thread to zip from chan1 and chan2 into zippedChan
setTimeout(async () => {
    while (true) {
        try {
            // stop when either chan1 or chan2 is sealed and empty
            let item1 = await chan1.get();
            let item2 = await chan2.get();
            await zippedChan.put([item1, item2]);
        } catch (err) {
            zippedChan.seal();
            break;
        }
    }
}, 0);

// thread to take first 3 items from zippedChan
setTimeout(() => {
    for (let ii = 0; ii < 3; ii++) {
        try {
            let item = await zippedChan.get();
            await firstThree.put(item);
        } catch (err) {
            firstThree.seal();
            break;
        }
    }
}, 0);
```

You could build up your own library of helper functions for these operations, but they're pretty easy to write so it's not very necessary.

### More details

You decide the length of the Chan's internal queue.
* If 0, there's no queue and an attempt to `put(item)` will block until there's a matching `get()` so the item can be handed directly between them.
* If a number, the queue will hold that many items.  When it's full, `put(item)` will block until there's room.
* If `null`, the queue size is unlimited and `put(item)` will never block.

`get` and `put` can be given an optional timeout value in milliseconds.  If they wait longer than that, they throw a `ChannelTimeoutError`.

A Chan can be **closed**.  This clears the queue of waiting items; any waiting get()s or put()s will fail with a `ChannelIsClosedError`, and any future attempts to get or put will also fail with the same error.  A closed Chan can't be opened again.

Closing a Chan is not a good way to signal that a sequence of items is complete because it clears the queue of waiting items.  Instead, you can **seal** the Chan.  This prevents any new items from being added, but lets existing items be pulled.  When the last item is pulled out, the Chan closes itself (at which point it is both sealed and closed).

Another way to signal that a sequence of items is complete is to use a special terminator item, like `null`, and handle it throughout your code.  This is up to you; it's not built into Chan.

See [the examples folder](https://github.com/cinnamon-bun/concurrency-friends/tree/main/src/example) for more demos.

```ts
let chan = new Chan<string>(3);  // buffer size of 3

// Add items to the channel.
// Remember to always use "await" here.
await chan.put('a');
await chan.put('b');
await chan.put('c');
// A fourth put() would block because the buffer size is 3

// Get an item from the channel.
// If there are none, this will block until 
// someone else puts something into the channel.
let a = await chan.get();

// Loop to consume items
while (true) {
    try {
        // Get existing item or wait for one to appear.
        // If 100ms passes with no items, give up.
        let item = await chan.get({ timeout: 100 });
        console.log(item);
    } catch (err) {
        // could be one of...
        // ChannelTimeoutError
        // ChannelIsClosedError
        // ChannelIsSealedError
        break;
    }
}

// Another way to consume items.
// If a timeout is not provided, this will run forever.
// With a timeout, it stops when the channel is empty for that long.
// Also stops if the channel is closed, or sealed-and-becomes-empty.
chan.forEach(
    item => console.log(item),
    { timeout: 100 })
);

// Close a channel permanently.
// Clears the buffer of items.
// All waiting get()s and put()s will throw a ChannelIsClosedError.
chan.close();
```

Several threads can get items from the same channel.  Each item will only go to one of the threads, because `get()`ting it will remove it from the channel.

# Conveyor in detail

A queue of items which are consumed by a single provided handler function,
one item at a time.

Users put items into the queue.  They are run one at a time through the handler,
using `await handlerFn(item)` in a loop, to make sure only one copy of the handler runs at a time.

The handler can be an async function (returning a promise) or a sync function.

```ts
// Example: running one at a time

let shout = async (name: string) => {
    // slowly shout a hello
    await sleep(100);
    console.log('HELLO...');
    await sleep(100);
    console.log('  ...' + name);
}

// (the types are the input and output types of the handler function)
let shouter = new Conveyor<string, void>(shout);

// Load up some data for the handler to process.
// We could await each push here, but instead we'll
// just keep running to demonstrate that shout is
// only run on one name at a time.
shouter.push('Alice');
shouter.push('Bob');
shouter.push('Carol');

console.log('done pushing names');

// output:
// note that the handler function is only running one at a time,
// not interleaved
//
//        done pushing names
//        HELLO...
//          ...Alice
//        HELLO...
//          ...Bob
//        HELLO...
//          ...Carol
```

When pushed, an item will be processed after queueMicrotask runs, or later.

Pushing items into the queue is an instant synchronous operation which never blocks or fails because the queue length is unlimited.  But if you `await push(item)`, you will be blocked until the handler is done running on that specific item, and you'll get back the return value from the handler function.

```ts
// Example: getting the return value
// The type signature is Conveyor<InputType, ReturnType>.

let squareSlowly = async (n: number): number => {
    await sleep(100);
    return n * n;
});
let squareConveyor = new Conveyor<number, number>(squareSlowly);

// push data to the handler function, which will run one at a time,
// and get the return value back.
let nine = await squareConveyor.push(3);
let twentyfive = await squareConveyor.push(5);
let onehundred = await squareConveyor.push(10);
```

Exceptions thrown by the handler function will come back as a rejected promise:

```ts
// Example: Errors thrown by the handler

let doSquareRoot = (n: number): number => {
    if (n < 0) { throw new Error("n is negative") }
    return Math.sqrt(n);
};
let conveyor = new Conveyor<number, number>(doSquareRoot);

// Push data to the handler function and get the return value back.
let three = await conveyor.push(9);

// The handler function throws an error in this case and we get it back:
try {
    let oops = await conveyor.push(-1);
} catch (err) {
    // Error("n is negative")
}
```

This is actually a priority queue behind the scenes.

You can provide your own priority as a second parameter to `push`, like `push(item, 7)`.

Priorities can be numbers or strings.  Items with lower priorities will go first, when there's more than one item waiting (lower numbers, or earlier-sorting strings).

Items without priorities are given an auto-incrementing priority number that starts at 1000.  Watch out that these might sort into the middle of your custom-provided priorities, if you are mixing items with and without explicit priorities.

```ts
// Example: priority queue Conveyor

// sort alphabetically and process in that order (ascending)
let sortKeyFn = (s: string) => s;

// you can use synchronous handler functions too, they
// don't have to be async
let shoutHandler = (name: string) => console.log('HELLO ' + name);

let shouter = new Conveyor<string, void>(shoutHandler, sortKeyFn);

//           item     priority
shouter.push('Bob',   'B');
shouter.push('Alice', 'A');
shouter.push('Carol', 'C');

// after queueMicrotask would have run,
// the handler will run on the items in sorted order.

// output
//      HELLO Alice
//      HELLO Bob
//      HELLO Carol
```

# Lock in detail

A `Lock` is a way to only allow one async function to run at a time.

Use it when you have "critical sections" of code that you want to run uninterrupted by other functions.

Comparison:
* A Conveyor pushes many different **pieces of data** into a single **handler function**, one at a time.
* A Lock runs many different **functions** one at a time.

Feed your Lock some functions to run.  They can be sync or async functions.

It will run them **one at a time** in the same order they were provided,
waiting for each one to finish before moving on to the next one, and returning the value of each one.

It keeps an internal queue of functions waiting for their turn to run.  You can also give your functions a priority which controls the order they run in, if many are waiting, using an internal priority queue.

## Example

```ts
let lock = new Lock();

// queue up some functions to run
// normally you would await lock.run, but in this example
// we want to demonstrate that they really do run one at a time.
lock.run(async () => {
    await sleep(10);
    console.log('function 1');
    await sleep(10);
    console.log('  function 1');
    await sleep(10);
    console.log('    function 1');
});

lock.run(() => {
    // this function won't begin until the previous one is finished.
    // you can also use regular synchronous functions.
    console.log('function 2');
    console.log('  function 2');
    console.log('    function 2');
});

lock.run(async () => {
    await sleep(10);
    console.log('function 3');
    await sleep(10);
    console.log('  function 3');
    await sleep(10);
    console.log('    function 3');
});

// Note that we didn't await lock.run in this example,
// and our functions don't start until after queueMicrotask
// would have run,
// so this is the first thing that will be printed:
console.log('done queueing up functions');

// output: the functions run one at a time, not interleaved
//
//    done queueing up functions
//    function 1
//      function 1
//        function 1
//    function 2
//      function 2
//        function 2
//    function 3
//      function 3
//        function 3
```

Functions provided to `lock.run` won't be started until queueMicrotask would have run, or later.

Usually you will `await lock.run(yourFn)` to wait until your specific function is done running, which might take a while if the queue is long:

```ts
await lock.run(async () => {
    // do some specific things
});
// those specific things are now done
```

Your functions can return values:

```ts
let lock = new Lock<number>();

let seven = await lock.run(async () => {
    return 7;
});
```

## Lock API

### Constructor

`let lock = new Lock<R>();`

`R` is the return type of the functions that will run in the lock.  It can be omitted if you don't care about the return type.

### Run

```ts
await result = lock.run(fn, opts?);

interface LockOpts: {
    priority?: number,
    bypass?: boolean,
}
```

Queue up a function to run when the lock is free, wait for it to run, and return the result (or throw any error thrown by the function).

The function should match this type:
```ts
type YourFunction<R> = () => R | Promise<R>;
```

e.g. it takes no parameters, and returns either an `R` or a promise for an `R`.  It can be a synchronous or async function.

## Return values and function parameters

If your function returns something, you can get it back with `await`.

There's no way to pass parameters to the functions, but you can pass them in from the outside using a closure.

```ts
// tell Lock it will have a return type of "number"
let lock = new Lock<number>();

// get return value
let seven = await lock.run(() => {
    return 7;
});

// pass in params from outside
let double = (x: number) => x * 2;

let myParam = 6;
let twelve = await lock.run(() => {
    return double(myParam);
});
```

## Errors

If the function you're calling in `lock.run` throws an error, the error will emerge where you have `await`ed it, as you'd expect.

## Priority

The regular `Lock` class lets you provide a number or string priority with each function. When there are multiple functions waiting in the queue, the **lower** valued ones will run first.

(This is built on Conveyor; read the Conveyor docs to learn more about priorities.)

The method is:

```ts
await result = lock.run(fn, { priority: 123 });
```

where priority is `number | string`.

```ts
let lock = new Lock();

lock.run(() => console.log('three'), { priority: 3 });
lock.run(() => console.log('seven'), { priority: 7 });
lock.run(() => console.log('two'),   { priority: 2 });

// Output:
// Lowest priority runs first, as long as they are
// all waiting in the queue at the same time (e.g.
// none have gotten a chance to start running yet)
//
//     two
//     three
//     seven
```

## Bypass

You can bypass the lock and just run you function directly using the `bypass` option:

```ts
await lock.run(() => console.log('hello'), { bypass: true });
```

This is useful if you sometimes want to run your code without waiting for the lock.  Maybe, for example, you're in a nested function and you know the lock has already been obtained, and you don't want to get it again to avoid deadlock.

## Deadlock

Don't try to use the lock from inside itself, or you'll get stuck waiting forever:

```ts
let lock = new Lock();

lock.run(() => {
    // DO NOT DO THIS.
    // This will get stuck waiting forever.
    lock.run(() => { console.log('nested') });
});
```

This might sneak up on you if it happens across several functions.  Be careful.

```ts
let lock = new Lock();

// DO NOT DO THIS

let doSomething = () => {
    // deadlock happens here...
    lock.run(() => { console.log('doing something') });
}

let doSomethingBigger = () => {
    lock.run(() => {
        console.log('Gonna do a thing.');
        doSomething(); // because it's called from inside the lock already
        console.log('I did a thing!');
    });
}
```

## Using several locks safely

If you have several locks, you can avoid deadlock by always getting the locks in the same order:

```ts
let lockAmy = new Lock();
let lockSam = new Lock();

let balances: Record<string, number> = {
    amy: 100,
    sam: 100,
}

let transferMoney = async (amount) => {
    // Always get the locks in the same order here.
    // In this case, alphabetical order.
    // If we were ever to do it in a different order elsewhere,
    // we could get a deadlock.
    await lockAmy.run(async () => {
        await lockSam.run(async () => {
            balances.amy -= amount;
            balances.sam += amount;
        });
    });
}
```

# Other stuff

## Deferred

This module exports helper code for `Deferred<T>` objects.

A `Deferred` is a Promise with its resolve and reject functions exposed for use from the outside.

```ts
export interface Deferred<T> {
    promise: Promise<T>;
    resolve: ResolveFn<T>;
    reject: RejectFn;
}

export let makeDeferred = <T>(): Deferred<T> => {
    //  ... returns a new Deferred
}
```

This is useful if you're doing tricky stuff with promises, as we do in many places in this package.  For example: making a queue of Deferreds, returning their Promise, then later resolving or rejecting them when some event happens.

# Develop

## File dependency chart

`A --> B` means file A imports file B.

The brown boxes are external libraries.

Just the basics:

![](depchart/depchart-basic.png)

All the files:

![](depchart/depchart-all.png)

To regenerate these diagrams, run `yarn depchart`.  You'll need `graphviz` installed.

## Updating the README table of contents

`yarn toc`
