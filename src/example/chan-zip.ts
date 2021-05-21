import { Chan2 } from '../chan2';
import { sleep } from '../util';

// In this example we use `null` to signal that a channel is done.
// Also in this example, each function is responsible for creating
// its own output channel.

let makeItems = (name: string, count: number): Chan2<string | null> => {
    let outChan = new Chan2<string | null>(2);
    setImmediate(async () => {
        // Put some items into the channel
        for (let ii = 0; ii < count; ii++) {
            // Wait a random amount of time, to allow
            // these channels to get out of sync with each other
            // for demo purposes
            sleep(Math.random() * 100);
            let item = `${name}:${ii}`;
            console.log(`${name} sending ${item}`);
            await outChan.put(item);
        }
        console.log(`${name} is done`);
        outChan.put(null); // signal completion
    });
    return outChan;
};

let zip = <T>(chan1: Chan2<T | null>, chan2: Chan2<T | null>): Chan2<[T, T] | null> => {
    // Given two channels, output a series of pairs of items from each channel.
    // Stop when the shorter channel runs out.
    let outChan = new Chan2<[T, T] | null>(0);
    setImmediate(async () => {
        while (true) {
            let item1 = await chan1.get();
            let item2 = await chan2.get();
            if (item1 === null || item2 === null) {
                console.log('    zip: one or both of the inputs are done.  stopping.');
                outChan.put(null);
                return;
            } else {
                console.log('    zip: making a pair');
                outChan.put([item1, item2]);
            }
        }
    });
    return outChan;
};


let chA = makeItems('aa', 4);
let chB = makeItems('bbbb', 6);
let chPairs = zip(chA, chB);

chPairs.forEach(pair => {
    if (pair === null) {
        console.log('       zipped output is done');
    } else {
        console.log('       zipped output:', pair);
    }
});

/*
aa sending aa:0
aa sending aa:1
aa sending aa:2
bbbb sending bbbb:0
bbbb sending bbbb:1
bbbb sending bbbb:2
    zip: making a pair
       zipped output: [ 'aa:0', 'bbbb:0' ]
    zip: making a pair
aa sending aa:3
    zip: making a pair
       zipped output: [ 'aa:1', 'bbbb:1' ]
aa is done
bbbb sending bbbb:3
       zipped output: [ 'aa:2', 'bbbb:2' ]
bbbb sending bbbb:4
    zip: making a pair
bbbb sending bbbb:5
bbbb is done
    zip: one or both of the inputs are done.  stopping.
       zipped output: [ 'aa:3', 'bbbb:3' ]
       zipped output is done
*/
