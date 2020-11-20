import { Chan } from '../chan';
import { sleep } from '../util';

// Make a producer "thread" and a consumer "thread".

// In this example we make our own channel and hand it to 
// the functions; they don't have to create any channels.

let producer = async (chan: Chan<string>) => {
    // Put some items into the channel
    for (let ii = 0; ii < 6; ii++) {
        console.log(`producer sending item ${ii}`);
        await chan.put('item ' + ii)
    }
    // Put "done" to signal completion
    // (We shouldn't close the channel to signal completion,
    // because that would delete any items still in the buffer.)
    console.log('producer sending "done"');
    await chan.put('done');
    console.log('producer is stoppping.');
};

let consumer = async (chan: Chan<string>) => {
    while (true) {
        let item = await chan.get();
        console.log(`      consumer got ${item}`);
        if (item === 'done') {
            // stop when we get "done"
            break;
        } else {
            // otherwise do something slow to the item
            await sleep(100);
        }
    }
    console.log('      consumer is stopping.');
};

// make a channel with a buffer size of 3
let chan = new Chan<string>(3);

// run the threads simultaneously
producer(chan);
consumer(chan);

/*
OUTPUT:

producer sending item 0
producer sending item 1
      consumer got item 0
producer sending item 2
producer sending item 3
producer sending item 4
      consumer got item 1
      consumer got item 2
      consumer got item 3
      consumer got item 4
producer sending item 5
producer sending "done"
producer is stoppping.
      consumer got item 5
      consumer got done
      consumer is stopping.
*/
