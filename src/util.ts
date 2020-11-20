
export let sleep = (ms : number) : Promise<void> =>
    new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
    });
