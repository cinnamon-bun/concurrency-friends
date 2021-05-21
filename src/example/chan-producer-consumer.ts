import { Chan, ChannelIsSealedError } from '../chan';
import { sleep } from '../util';

// Make a producer "thread" and a consumer "thread".

// In this example we make our own channel and hand it to 
// the functions; they don't have to create any channels.

let producer = async (chan: Chan<string>) => {
    // Put some items into the channel
    for (let ii = 0; ii < 6; ii++) {
        console.log(`producer sending item ${ii}`);
        await chan.put('item ' + ii);
    }
    console.log('sealing producer to signal there is no more data');
    chan.seal();
    console.log('producer is done.');
};

let consumer = async (chan: Chan<string>) => {
    while (true) {
        try {
            let item = await chan.get();
            console.log(`      consumer got ${item}`);
            await sleep(100);
        } catch (err) {
            if (err instanceof ChannelIsSealedError) { break; }
            throw err;
        }
    }
    console.log('      consumer is done.');
};

// make a channel with a queue size of 3
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
sealing producer to signal there is no more data
producer is done.
      consumer got item 5
      consumer is done.
*/
