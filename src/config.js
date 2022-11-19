
import { parse } from "https://deno.land/std/flags/mod.ts";
import { logger, logAndExit } from "./logger.js";

// Set up defaults
const defaultConfig = {
    host: undefined,
    port: undefined,
    topic: "homeassistant/sensor/",
    entity:"spotprice",
    area: "SE2",
    currency: "SEK",
    decimals: 5,
    factor: 1,
    extra: 0,
    connectionTimeoutMs: 20 * 1000
};

// Parse cli arguments
const config = parse(Deno.args, { default: defaultConfig });

// Validate arguments
if (isNaN(parseInt(config.decimals, 10))) logAndExit("Invalid value passed to --decimals", 1);
if (isNaN(parseInt(config.port, 10))) logAndExit("Invalid value passed to --port", 1);
if (isNaN(parseFloat(config.factor))) logAndExit("Invalid value passed to --factor", 1);
if (isNaN(parseFloat(config.extra))) logAndExit("Invalid value passed to --extra", 1);
if (!config.topic.length) logAndExit("Invalid value passed to --topic", 1);
if (!config.entity.length) logAndExit("Invalid value passed to --entity", 1);
if (!config.area.length) logAndExit("Invalid value passed to --area", 1);
if (!config.currency.length) logAndExit("Invalid value passed to --currency", 1);
if (!config.host.length) logAndExit("--host must be specified", 1);
if (isNaN(parseInt(config.port))) logAndExit("Invalid value passed to --port", 1);

// Clean arguments
config.topic = config.topic.toLowerCase().trim();
config.entity = config.entity.toLowerCase().trim();
config.currency = config.currency.toUpperCase().trim();
config.area = config.area.toUpperCase().trim();
config.decimals = parseInt(config.decimals, 10),
config.factor = parseFloat(config.factor);
config.extra = parseFloat(config.extra);

// All good!
export { config };