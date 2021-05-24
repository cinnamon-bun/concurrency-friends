
import 'jest';

import LinkedList, { Node as LinkedListNode } from 'dbly-linked-list';
import { removeLinkedListNode } from '../chan';

//process.on('unhandledRejection', (reason : any, p : any) => {
//    console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
//});

test('remove only', async () => {
    let ll = new LinkedList();
    expect(ll.getSize()).toBe(0);
    ll.insert(0);
    expect(ll.getSize()).toBe(1);
    let n0 = ll.findAt(0);

    removeLinkedListNode(ll, n0);
    expect(ll.getHeadNode()).toBe(null);
    expect(ll.getTailNode()).toBe(null);
    expect(ll.getSize()).toBe(0);
    expect(ll.toArray()).toStrictEqual([]);
});

test('remove head of 2', async () => {
    let ll = new LinkedList();
    expect(ll.getSize()).toBe(0);
    ll.insert(0);
    ll.insert(1);
    expect(ll.getSize()).toBe(2);
    let n0 = ll.findAt(0);
    let n1 = ll.findAt(1);

    removeLinkedListNode(ll, n0);
    expect(ll.getHeadNode()).toBe(n1);
    expect(ll.getTailNode()).toBe(n1);
    expect(ll.getSize()).toBe(1);
    expect(ll.toArray()).toStrictEqual([1]);
});

test('remove tail of 2', async () => {
    let ll = new LinkedList();
    expect(ll.getSize()).toBe(0);
    ll.insert(0);
    ll.insert(1);
    expect(ll.getSize()).toBe(2);
    let n0 = ll.findAt(0);
    let n1 = ll.findAt(1);

    removeLinkedListNode(ll, n1);
    expect(ll.getHeadNode()).toBe(n0);
    expect(ll.getTailNode()).toBe(n0);
    expect(ll.getSize()).toBe(1);
    expect(ll.toArray()).toStrictEqual([0]);
});

test('remove head of 3', async () => {
    let ll = new LinkedList();
    expect(ll.getSize()).toBe(0);
    ll.insert(0);
    ll.insert(1);
    ll.insert(2);
    expect(ll.getSize()).toBe(3);
    let n0 = ll.findAt(0);
    let n1 = ll.findAt(1);
    let n2 = ll.findAt(2);

    removeLinkedListNode(ll, n0);
    expect(ll.getHeadNode()).toBe(n1);
    expect(ll.getTailNode()).toBe(n2);
    expect(ll.getSize()).toBe(2);
    expect(ll.toArray()).toStrictEqual([1, 2]);
});

test('remove middle of 3', async () => {
    let ll = new LinkedList();
    expect(ll.getSize()).toBe(0);
    ll.insert(0);
    ll.insert(1);
    ll.insert(2);
    expect(ll.getSize()).toBe(3);
    let n0 = ll.findAt(0);
    let n1 = ll.findAt(1);
    let n2 = ll.findAt(2);

    removeLinkedListNode(ll, n1);
    expect(ll.getHeadNode()).toBe(n0);
    expect(ll.getTailNode()).toBe(n2);
    expect(ll.getSize()).toBe(2);
    expect(ll.toArray()).toStrictEqual([0, 2]);
});

test('remove tail of 3', async () => {
    let ll = new LinkedList();
    expect(ll.getSize()).toBe(0);
    ll.insert(0);
    ll.insert(1);
    ll.insert(2);
    expect(ll.getSize()).toBe(3);
    let n0 = ll.findAt(0);
    let n1 = ll.findAt(1);
    let n2 = ll.findAt(2);

    removeLinkedListNode(ll, n2);
    expect(ll.getHeadNode()).toBe(n0);
    expect(ll.getTailNode()).toBe(n1);
    expect(ll.getSize()).toBe(2);
    expect(ll.toArray()).toStrictEqual([0, 1]);
});
