function logger(msg) {
    console.log(new Date().toLocaleString() + " - " + msg);
}

function logAndExit(msg, retCode) {
    logger(msg);
    Deno.exit(retCode);
}

export { logger, logAndExit };