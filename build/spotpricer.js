// deno-fmt-ignore-file
// deno-lint-ignore-file
// This code was bundled using `deno bundle` and it's not recommended to edit it manually

function encodeLength(x) {
    const output = [];
    do {
        let encodedByte = x % 128;
        x = Math.floor(x / 128);
        if (x > 0) {
            encodedByte = encodedByte | 128;
        }
        output.push(encodedByte);
    }while (x > 0)
    return output;
}
function decodeLength(buffer, startIndex) {
    let i = startIndex;
    let encodedByte = 0;
    let value = 0;
    let multiplier = 1;
    do {
        encodedByte = buffer[i++];
        value += (encodedByte & 127) * multiplier;
        if (multiplier > 128 * 128 * 128) {
            throw Error('malformed length');
        }
        multiplier *= 128;
    }while ((encodedByte & 128) != 0)
    return {
        length: value,
        bytesUsedToEncodeLength: i - startIndex
    };
}
function encodeUTF8String(str, encoder) {
    const bytes = encoder.encode(str);
    return [
        bytes.length >> 8,
        bytes.length & 0xff,
        ...bytes
    ];
}
function decodeUTF8String(buffer, startIndex, utf8Decoder) {
    const length = (buffer[startIndex] << 8) + buffer[startIndex + 1];
    const bytes = buffer.slice(startIndex + 2, startIndex + 2 + length);
    const value = utf8Decoder.decode(bytes);
    return {
        length: length + 2,
        value
    };
}
const __default = {
    encode (packet, utf8Encoder) {
        const protocolName = encodeUTF8String('MQTT', utf8Encoder);
        const usernameFlag = !!packet.username;
        const passwordFlag = !!packet.password;
        const willRetain = !!(packet.will && packet.will.retain);
        const willQoS = packet.will && packet.will.qos || 0;
        const willFlag = !!packet.will;
        const cleanSession = packet.clean || typeof packet.clean === 'undefined';
        const connectFlags = (usernameFlag ? 128 : 0) + (passwordFlag ? 64 : 0) + (willRetain ? 32 : 0) + (willQoS & 2 ? 16 : 0) + (willQoS & 1 ? 8 : 0) + (willFlag ? 4 : 0) + (cleanSession ? 2 : 0);
        const keepAlive = packet.keepAlive && typeof packet.keepAlive !== 'undefined' ? packet.keepAlive : 0;
        const variableHeader = [
            ...protocolName,
            4,
            connectFlags,
            keepAlive >> 8,
            keepAlive & 0xff
        ];
        const payload = [
            ...encodeUTF8String(packet.clientId, utf8Encoder)
        ];
        if (packet.username) {
            payload.push(...encodeUTF8String(packet.username, utf8Encoder));
        }
        if (packet.password) {
            payload.push(...encodeUTF8String(packet.password, utf8Encoder));
        }
        const fixedHeader = [
            1 << 4 | 0,
            ...encodeLength(variableHeader.length + payload.length)
        ];
        return [
            ...fixedHeader,
            ...variableHeader,
            ...payload
        ];
    },
    decode (buffer, remainingStart, _remainingLength, utf8Decoder) {
        const protocolNameStart = remainingStart;
        const protocolName = decodeUTF8String(buffer, protocolNameStart, utf8Decoder);
        const protocolLevelIndex = protocolNameStart + protocolName.length;
        const protocolLevel = buffer[protocolLevelIndex];
        const connectFlagsIndex = protocolLevelIndex + 1;
        const connectFlags = buffer[connectFlagsIndex];
        const usernameFlag = !!(connectFlags & 128);
        const passwordFlag = !!(connectFlags & 64);
        const willRetain = !!(connectFlags & 32);
        const willQoS = (connectFlags & 16 + 8) >> 3;
        const willFlag = !!(connectFlags & 4);
        const cleanSession = !!(connectFlags & 2);
        if (willQoS !== 0 && willQoS !== 1 && willQoS !== 2) {
            throw new Error('invalid will qos');
        }
        const keepAliveIndex = connectFlagsIndex + 1;
        const keepAlive = (buffer[keepAliveIndex] << 8) + buffer[keepAliveIndex + 1];
        const clientIdStart = keepAliveIndex + 2;
        const clientId = decodeUTF8String(buffer, clientIdStart, utf8Decoder);
        let username;
        let password;
        const usernameStart = clientIdStart + clientId.length;
        if (usernameFlag) {
            username = decodeUTF8String(buffer, usernameStart, utf8Decoder);
        }
        if (passwordFlag) {
            const passwordStart = usernameStart + (username ? username.length : 0);
            password = decodeUTF8String(buffer, passwordStart, utf8Decoder);
        }
        return {
            type: 'connect',
            protocolName: protocolName.value,
            protocolLevel,
            clientId: clientId.value,
            username: username ? username.value : undefined,
            password: password ? password.value : undefined,
            will: willFlag ? {
                retain: willRetain,
                qos: willQoS
            } : undefined,
            clean: cleanSession,
            keepAlive
        };
    }
};
const __default1 = {
    encode (packet) {
        return [
            (2 << 4) + 0,
            2,
            packet.sessionPresent ? 1 : 0,
            packet.returnCode || 0
        ];
    },
    decode (buffer, _remainingStart, _remainingLength) {
        const sessionPresent = !!(buffer[2] & 1);
        const returnCode = buffer[3];
        return {
            type: 'connack',
            sessionPresent,
            returnCode
        };
    }
};
const __default2 = {
    encode (packet, utf8Encoder) {
        const qos = packet.qos || 0;
        const flags = (packet.dup ? 8 : 0) + (qos & 2 ? 4 : 0) + (qos & 1 ? 2 : 0) + (packet.retain ? 1 : 0);
        const variableHeader = [
            ...encodeUTF8String(packet.topic, utf8Encoder)
        ];
        if (qos === 1 || qos === 2) {
            if (typeof packet.id !== 'number' || packet.id < 1) {
                throw new Error('when qos is 1 or 2, packet must have id');
            }
            variableHeader.push(packet.id >> 8, packet.id & 0xff);
        }
        let payload = packet.payload;
        if (typeof payload === 'string') {
            payload = utf8Encoder.encode(payload);
        }
        const fixedHeader = [
            3 << 4 | flags,
            ...encodeLength(variableHeader.length + payload.length)
        ];
        return [
            ...fixedHeader,
            ...variableHeader,
            ...payload
        ];
    },
    decode (buffer, remainingStart, remainingLength, utf8Decoder) {
        const flags = buffer[0] & 0x0f;
        const dup = !!(flags & 8);
        const qos = (flags & 6) >> 1;
        const retain = !!(flags & 1);
        if (qos !== 0 && qos !== 1 && qos !== 2) {
            throw new Error('invalid qos');
        }
        const topicStart = remainingStart;
        const decodedTopic = decodeUTF8String(buffer, topicStart, utf8Decoder);
        const topic = decodedTopic.value;
        let id = 0;
        let payloadStart = topicStart + decodedTopic.length;
        if (qos > 0) {
            const idStart = payloadStart;
            id = (buffer[idStart] << 8) + buffer[idStart + 1];
            payloadStart += 2;
        }
        const payload = buffer.slice(payloadStart, remainingStart + remainingLength);
        return {
            type: 'publish',
            topic,
            payload,
            dup,
            retain,
            qos,
            id
        };
    }
};
const __default3 = {
    encode (packet) {
        return [
            (4 << 4) + 0,
            2,
            packet.id >> 8,
            packet.id & 0xff
        ];
    },
    decode (buffer, _remainingStart, _remainingLength) {
        const id = (buffer[2] << 8) + buffer[3];
        return {
            type: 'puback',
            id
        };
    }
};
const __default4 = {
    encode (packet) {
        return [
            (5 << 4) + 0,
            2,
            packet.id >> 8,
            packet.id & 0xff
        ];
    },
    decode (buffer, _remainingStart, _remainingLength) {
        const id = (buffer[2] << 8) + buffer[3];
        return {
            type: 'pubrec',
            id
        };
    }
};
const __default5 = {
    encode (packet) {
        return [
            (6 << 4) + 2,
            2,
            packet.id >> 8,
            packet.id & 0xff
        ];
    },
    decode (buffer, _remainingStart, _remainingLength) {
        const id = (buffer[2] << 8) + buffer[3];
        return {
            type: 'pubrel',
            id
        };
    }
};
const __default6 = {
    encode (packet) {
        return [
            (7 << 4) + 0,
            2,
            packet.id >> 8,
            packet.id & 0xff
        ];
    },
    decode (buffer, _remainingStart, _remainingLength) {
        const id = (buffer[2] << 8) + buffer[3];
        return {
            type: 'pubcomp',
            id
        };
    }
};
const __default7 = {
    encode (packet, utf8Encoder) {
        const variableHeader = [
            packet.id >> 8,
            packet.id & 0xff
        ];
        const payload = [];
        for (const sub of packet.subscriptions){
            payload.push(...encodeUTF8String(sub.topicFilter, utf8Encoder), sub.qos);
        }
        const fixedHeader = [
            8 << 4 | 0b0010,
            ...encodeLength(variableHeader.length + payload.length)
        ];
        return [
            ...fixedHeader,
            ...variableHeader,
            ...payload
        ];
    },
    decode (buffer, remainingStart, _remainingLength, utf8Decoder) {
        const idStart = remainingStart;
        const id = (buffer[idStart] << 8) + buffer[idStart + 1];
        const subscriptionsStart = idStart + 2;
        const subscriptions = [];
        for(let i = subscriptionsStart; i < buffer.length;){
            const topicFilter = decodeUTF8String(buffer, i, utf8Decoder);
            i += topicFilter.length;
            const qos = buffer[i];
            i += 1;
            if (qos !== 0 && qos !== 1 && qos !== 2) {
                throw new Error('invalid qos');
            }
            subscriptions.push({
                topicFilter: topicFilter.value,
                qos
            });
        }
        return {
            type: 'subscribe',
            id,
            subscriptions
        };
    }
};
const __default8 = {
    encode (packet) {
        return [
            (9 << 4) + 0,
            2 + packet.returnCodes.length,
            packet.id >> 8,
            packet.id & 0xff,
            ...packet.returnCodes
        ];
    },
    decode (buffer, remainingStart, _remainingLength) {
        const idStart = remainingStart;
        const id = (buffer[idStart] << 8) + buffer[idStart + 1];
        const payloadStart = idStart + 2;
        const returnCodes = [];
        for(let i = payloadStart; i < buffer.length; i++){
            returnCodes.push(buffer[i]);
        }
        return {
            type: 'suback',
            id,
            returnCodes
        };
    }
};
const __default9 = {
    encode (packet, utf8Encoder) {
        const variableHeader = [
            packet.id >> 8,
            packet.id & 0xff
        ];
        const payload = [];
        for (const topic of packet.topicFilters){
            payload.push(...encodeUTF8String(topic, utf8Encoder));
        }
        const fixedHeader = [
            0b1010 << 4 | 0b0010,
            ...encodeLength(variableHeader.length + payload.length)
        ];
        return [
            ...fixedHeader,
            ...variableHeader,
            ...payload
        ];
    },
    decode (buffer, remainingStart, _remainingLength, utf8Decoder) {
        const idStart = remainingStart;
        const id = (buffer[idStart] << 8) + buffer[idStart + 1];
        const topicFiltersStart = idStart + 2;
        const topicFilters = [];
        for(let i = topicFiltersStart; i < buffer.length;){
            const topicFilter = decodeUTF8String(buffer, i, utf8Decoder);
            i += topicFilter.length;
            topicFilters.push(topicFilter.value);
        }
        return {
            type: 'unsubscribe',
            id,
            topicFilters
        };
    }
};
const __default10 = {
    encode (packet) {
        return [
            (11 << 4) + 0,
            2,
            packet.id >> 8,
            packet.id & 0xff
        ];
    },
    decode (buffer, _remainingStart, _remainingLength) {
        const id = (buffer[2] << 8) + buffer[3];
        return {
            type: 'unsuback',
            id
        };
    }
};
const __default11 = {
    encode (_packet) {
        return [
            (0b1100 << 4) + 0b0000,
            0
        ];
    },
    decode (_buffer, _remainingStart, _remainingLength) {
        return {
            type: 'pingreq'
        };
    }
};
const __default12 = {
    encode (_packet) {
        return [
            0xd0,
            0
        ];
    },
    decode (_buffer, _remainingStart, _remainingLength) {
        return {
            type: 'pingres'
        };
    }
};
const __default13 = {
    encode (_packet) {
        return [
            14 << 4 | 0,
            0
        ];
    },
    decode (_buffer, _remainingStart, _remainingLength) {
        return {
            type: 'disconnect'
        };
    }
};
const packetTypesByName = {
    connect: __default,
    connack: __default1,
    publish: __default2,
    puback: __default3,
    pubrec: __default4,
    pubrel: __default5,
    pubcomp: __default6,
    subscribe: __default7,
    suback: __default8,
    unsubscribe: __default9,
    unsuback: __default10,
    pingreq: __default11,
    pingres: __default12,
    disconnect: __default13
};
const packetTypesById = [
    null,
    __default,
    __default1,
    __default2,
    __default3,
    __default4,
    __default5,
    __default6,
    __default7,
    __default8,
    __default9,
    __default10,
    __default11,
    __default12,
    __default13
];
function encode(packet, utf8Encoder) {
    const name = packet.type;
    const packetType = packetTypesByName[name];
    if (!packetType) {
        throw new Error(`packet type ${name} cannot be encoded`);
    }
    return Uint8Array.from(packetType.encode(packet, utf8Encoder));
}
function decode(buffer, utf8Decoder) {
    if (buffer.length < 2) {
        return null;
    }
    const id = buffer[0] >> 4;
    const packetType = packetTypesById[id];
    if (!packetType) {
        throw new Error(`packet type ${id} cannot be decoded`);
    }
    const { length: remainingLength , bytesUsedToEncodeLength  } = decodeLength(buffer, 1);
    const packetLength = 1 + bytesUsedToEncodeLength + remainingLength;
    if (buffer.length < packetLength) {
        return null;
    }
    const packet = packetType.decode(buffer, 1 + bytesUsedToEncodeLength, remainingLength, utf8Decoder);
    if (!packet) {
        return null;
    }
    const packetWithLength = packet;
    packetWithLength.length = packetLength;
    return packetWithLength;
}
const packetIdLimit = 2 ** 16;
class IncomingStore {
}
class IncomingMemoryStore extends IncomingStore {
    packets = new Set();
    async store(packetId) {
        this.packets.add(packetId);
    }
    async has(packetId) {
        return this.packets.has(packetId);
    }
    async discard(packetId) {
        this.packets.delete(packetId);
    }
}
class OutgoingStore {
}
class OutgoingMemoryStore extends OutgoingStore {
    packets = new Map();
    async store(packet) {
        if (!packet.id) {
            throw new Error('missing packet.id');
        }
        this.packets.set(packet.id, packet);
    }
    async discard(packetId) {
        this.packets.delete(packetId);
    }
    async *iterate() {
        for (const value of this.packets.values()){
            yield value;
        }
    }
}
const defaultPorts = {
    mqtt: 1883,
    mqtts: 8883,
    ws: 80,
    wss: 443
};
const defaultClientIdPrefix = 'mqttts';
const defaultKeepAlive = 60;
const defaultConnectTimeout = 10 * 1000;
const defaultConnectOptions = {
    retries: Infinity,
    minDelay: 1000,
    maxDelay: 2000,
    factor: 1.1,
    random: false
};
const defaultReconnectOptions = {
    retries: Infinity,
    minDelay: 1000,
    maxDelay: 60000,
    factor: 1.1,
    random: true
};
class Client {
    options;
    url;
    clientId;
    keepAlive;
    connectionState = 'offline';
    everConnected = false;
    disconnectRequested = false;
    reconnectAttempt = 0;
    subscriptions = [];
    lastPacketId = 0;
    lastPacketTime;
    buffer = null;
    unresolvedConnect;
    queuedPublishes = [];
    unresolvedPublishes = new Map();
    incomingStore;
    outgoingStore;
    unresolvedSubscribes = new Map();
    unresolvedUnsubscribes = new Map();
    unacknowledgedSubscribes = new Map();
    unacknowledgedUnsubscribes = new Map();
    eventListeners = new Map();
    timers = {};
    log;
    constructor(options){
        this.options = options || {};
        this.clientId = this.generateClientId();
        this.keepAlive = typeof this.options.keepAlive === 'number' ? this.options.keepAlive : defaultKeepAlive;
        this.incomingStore = this.options.incomingStore || new IncomingMemoryStore();
        this.outgoingStore = this.options.outgoingStore || new OutgoingMemoryStore();
        this.log = this.options.logger || (()=>{});
    }
    async connect() {
        switch(this.connectionState){
            case 'offline':
            case 'disconnected':
                break;
            default:
                throw new Error(`should not be connecting in ${this.connectionState} state`);
        }
        this.disconnectRequested = false;
        const deferred = new Deferred();
        this.unresolvedConnect = deferred;
        this.openConnection();
        return deferred.promise;
    }
    async publish(topic, payload, options) {
        const dup = options && options.dup || false;
        const qos = options && options.qos || 0;
        const retain = options && options.retain || false;
        const id = qos > 0 ? this.nextPacketId() : 0;
        const packet = {
            type: 'publish',
            dup,
            qos,
            retain,
            topic,
            payload,
            id
        };
        const deferred = new Deferred();
        if (this.connectionState === 'connected') {
            this.sendPublish(packet, deferred);
        } else {
            this.log('queueing publish');
            this.queuedPublishes.push({
                packet,
                deferred
            });
        }
        return deferred.promise;
    }
    async flushQueuedPublishes() {
        let queued;
        while(queued = this.queuedPublishes.shift()){
            const { packet , deferred  } = queued;
            this.sendPublish(packet, deferred);
        }
    }
    async flushUnacknowledgedPublishes() {
        for await (const packet of this.outgoingStore.iterate()){
            if (packet.type === 'publish') {
                await this.send({
                    ...packet,
                    dup: true
                });
            } else {
                await this.send(packet);
            }
        }
    }
    async sendPublish(packet, deferred) {
        if (packet.qos && packet.qos > 0) {
            this.unresolvedPublishes.set(packet.id, deferred);
            this.outgoingStore.store(packet);
        }
        await this.send(packet);
        if (!packet.qos) {
            deferred.resolve();
        }
    }
    async subscribe(input, qos) {
        switch(this.connectionState){
            case 'disconnecting':
            case 'disconnected':
                throw new Error(`should not be subscribing in ${this.connectionState} state`);
        }
        const arr = Array.isArray(input) ? input : [
            input
        ];
        const subs = arr.map((sub)=>{
            return typeof sub === 'object' ? {
                topicFilter: sub.topicFilter,
                qos: sub.qos || qos || 0,
                state: 'pending'
            } : {
                topicFilter: sub,
                qos: qos || 0,
                state: 'pending'
            };
        });
        const promises = [];
        for (const sub of subs){
            this.subscriptions = this.subscriptions.filter((old)=>old.topicFilter !== sub.topicFilter);
            this.subscriptions.push(sub);
            const deferred = new Deferred();
            this.unresolvedSubscribes.set(sub.topicFilter, deferred);
            promises.push(deferred.promise.then(()=>sub));
        }
        await this.flushSubscriptions();
        return Promise.all(promises);
    }
    async flushSubscriptions() {
        const subs = this.subscriptions.filter((sub)=>sub.state === 'pending');
        if (subs.length > 0 && this.connectionState === 'connected') {
            await this.sendSubscribe(subs);
        }
    }
    async sendSubscribe(subscriptions) {
        const subscribePacket = {
            type: 'subscribe',
            id: this.nextPacketId(),
            subscriptions: subscriptions.map((sub)=>({
                    topicFilter: sub.topicFilter,
                    qos: sub.qos
                }))
        };
        this.unacknowledgedSubscribes.set(subscribePacket.id, {
            subscriptions
        });
        await this.send(subscribePacket);
        for (const sub of subscriptions){
            sub.state = 'unacknowledged';
        }
    }
    async unsubscribe(input) {
        switch(this.connectionState){
            case 'disconnecting':
            case 'disconnected':
                throw new Error(`should not be unsubscribing in ${this.connectionState} state`);
        }
        const arr = Array.isArray(input) ? input : [
            input
        ];
        const promises = [];
        for (const topicFilter of arr){
            const sub = this.subscriptions.find((sub)=>sub.topicFilter === topicFilter) || {
                topicFilter,
                qos: 0,
                state: 'unknown'
            };
            const deferred = new Deferred();
            const promise = deferred.promise.then(()=>sub);
            if (this.connectionState !== 'connected' && this.options.clean !== false) {
                sub.state = 'removed';
            } else {
                switch(sub.state){
                    case 'pending':
                        sub.state = 'removed';
                        break;
                    case 'removed':
                    case 'replaced':
                        break;
                    case 'unknown':
                    case 'unacknowledged':
                    case 'acknowledged':
                        sub.state = 'unsubscribe-pending';
                        break;
                    case 'unsubscribe-pending':
                    case 'unsubscribe-unacknowledged':
                    case 'unsubscribe-acknowledged':
                        break;
                }
            }
            this.unresolvedUnsubscribes.set(topicFilter, deferred);
            promises.push(promise);
        }
        await this.flushUnsubscriptions();
        return Promise.all(promises);
    }
    async flushUnsubscriptions() {
        const subs = [];
        for (const sub of this.subscriptions){
            if (sub.state === 'removed') {
                const unresolvedSubscribe = this.unresolvedSubscribes.get(sub.topicFilter);
                if (unresolvedSubscribe) {
                    this.unresolvedSubscribes.delete(sub.topicFilter);
                    unresolvedSubscribe.resolve(null);
                }
                const unresolvedUnsubscribe = this.unresolvedUnsubscribes.get(sub.topicFilter);
                if (unresolvedUnsubscribe) {
                    this.unresolvedUnsubscribes.delete(sub.topicFilter);
                    unresolvedUnsubscribe.resolve(null);
                }
            }
            if (sub.state === 'unsubscribe-pending') {
                subs.push(sub);
            }
        }
        this.subscriptions = this.subscriptions.filter((sub)=>sub.state !== 'removed');
        if (subs.length > 0 && this.connectionState === 'connected') {
            await this.sendUnsubscribe(subs);
        }
    }
    async sendUnsubscribe(subscriptions) {
        const unsubscribePacket = {
            type: 'unsubscribe',
            id: this.nextPacketId(),
            topicFilters: subscriptions.map((sub)=>sub.topicFilter)
        };
        this.unacknowledgedUnsubscribes.set(unsubscribePacket.id, {
            subscriptions
        });
        await this.send(unsubscribePacket);
        for (const sub of subscriptions){
            sub.state = 'unsubscribe-unacknowledged';
        }
    }
    async disconnect() {
        switch(this.connectionState){
            case 'connected':
                await this.doDisconnect();
                break;
            case 'connecting':
                this.disconnectRequested = true;
                break;
            case 'offline':
                this.changeState('disconnected');
                this.stopTimers();
                break;
            default:
                throw new Error(`should not be disconnecting in ${this.connectionState} state`);
        }
    }
    async doDisconnect() {
        this.changeState('disconnecting');
        this.stopTimers();
        await this.send({
            type: 'disconnect'
        });
        await this.close();
    }
    encode(packet, utf8Encoder) {
        return encode(packet, utf8Encoder);
    }
    decode(bytes, utf8Decoder) {
        return decode(bytes, utf8Decoder);
    }
    async openConnection() {
        try {
            this.changeState('connecting');
            this.url = this.getURL();
            this.log(`opening connection to ${this.url}`);
            await this.open(this.url);
            await this.send({
                type: 'connect',
                clientId: this.clientId,
                username: this.options.username,
                password: this.options.password,
                clean: this.options.clean !== false,
                keepAlive: this.keepAlive
            });
            this.startConnectTimer();
        } catch (err) {
            this.log(`caught error opening connection: ${err.message}`);
            this.changeState('offline');
            if (!this.startReconnectTimer()) {
                this.notifyConnectRejected(new Error('connection failed'));
            }
        }
    }
    async connectionEstablished(connackPacket) {
        if (this.options.clean !== false || !connackPacket.sessionPresent) {
            for (const sub of this.subscriptions){
                if (sub.state === 'unsubscribe-pending') {
                    sub.state = 'removed';
                } else {
                    sub.state = 'pending';
                }
            }
        }
        await this.flushSubscriptions();
        await this.flushUnsubscriptions();
        await this.flushUnacknowledgedPublishes();
        await this.flushQueuedPublishes();
        if (this.unresolvedConnect) {
            this.log('resolving initial connect');
            this.unresolvedConnect.resolve(connackPacket);
        }
        if (this.disconnectRequested) {
            this.doDisconnect();
        } else {
            this.startKeepAliveTimer();
        }
    }
    connectionClosed() {
        this.log('connectionClosed');
        switch(this.connectionState){
            case 'disconnecting':
                this.changeState('disconnected');
                break;
            default:
                this.changeState('offline');
                this.reconnectAttempt = 0;
                this.startReconnectTimer();
                break;
        }
        this.stopKeepAliveTimer();
    }
    connectionError(error) {
        this.log('connectionError', error);
    }
    bytesReceived(bytes) {
        this.log('bytes received', bytes);
        this.emit('bytesreceived', bytes);
        let buffer = bytes;
        const oldBuffer = this.buffer;
        if (oldBuffer) {
            const newBuffer = new Uint8Array(oldBuffer.length + bytes.length);
            newBuffer.set(oldBuffer);
            newBuffer.set(bytes, oldBuffer.length);
            buffer = newBuffer;
        } else {
            buffer = bytes;
        }
        do {
            const packet = this.decode(buffer);
            if (!packet) {
                break;
            }
            this.log(`received ${packet.type} packet`, packet);
            this.packetReceived(packet);
            if (packet.length < buffer.length) {
                buffer = buffer.slice(packet.length);
            } else {
                buffer = null;
            }
        }while (buffer)
        this.buffer = buffer;
    }
    packetReceived(packet) {
        this.emit('packetreceive', packet);
        switch(packet.type){
            case 'connack':
                this.handleConnack(packet);
                break;
            case 'publish':
                this.handlePublish(packet);
                break;
            case 'puback':
                this.handlePuback(packet);
                break;
            case 'pubrec':
                this.handlePubrec(packet);
                break;
            case 'pubrel':
                this.handlePubrel(packet);
                break;
            case 'pubcomp':
                this.handlePubcomp(packet);
                break;
            case 'suback':
                this.handleSuback(packet);
                break;
            case 'unsuback':
                this.handleUnsuback(packet);
                break;
        }
    }
    protocolViolation(msg) {
        this.log('protocolViolation', msg);
    }
    handleConnack(packet) {
        switch(this.connectionState){
            case 'connecting':
                break;
            default:
                throw new Error(`should not be receiving connack packets in ${this.connectionState} state`);
        }
        this.changeState('connected');
        this.everConnected = true;
        this.stopConnectTimer();
        this.connectionEstablished(packet);
    }
    async handlePublish(packet) {
        if (packet.qos === 0) {
            this.emit('message', packet.topic, packet.payload, packet);
        } else if (packet.qos === 1) {
            if (typeof packet.id !== 'number' || packet.id < 1) {
                return this.protocolViolation('publish packet with qos 1 is missing id');
            }
            this.emit('message', packet.topic, packet.payload, packet);
            this.send({
                type: 'puback',
                id: packet.id
            });
        } else if (packet.qos === 2) {
            if (typeof packet.id !== 'number' || packet.id < 1) {
                return this.protocolViolation('publish packet with qos 2 is missing id');
            }
            const emitMessage = !packet.dup || !await this.incomingStore.has(packet.id);
            if (emitMessage) {
                this.incomingStore.store(packet.id);
                this.emit('message', packet.topic, packet.payload, packet);
            }
            this.send({
                type: 'pubrec',
                id: packet.id
            });
        }
    }
    handlePuback(packet) {
        this.outgoingStore.discard(packet.id);
        const deferred = this.unresolvedPublishes.get(packet.id);
        if (deferred) {
            this.unresolvedPublishes.delete(packet.id);
            deferred.resolve();
        } else {
            this.log(`received puback packet with unrecognized id ${packet.id}`);
        }
    }
    handlePubrec(packet) {
        const pubrel = {
            type: 'pubrel',
            id: packet.id
        };
        this.outgoingStore.store(pubrel);
        this.send(pubrel);
    }
    handlePubrel(packet) {
        this.incomingStore.discard(packet.id);
        this.send({
            type: 'pubcomp',
            id: packet.id
        });
    }
    handlePubcomp(packet) {
        this.outgoingStore.discard(packet.id);
        const deferred = this.unresolvedPublishes.get(packet.id);
        if (deferred) {
            this.unresolvedPublishes.delete(packet.id);
            deferred.resolve();
        } else {
            this.log(`received pubcomp packet with unrecognized id ${packet.id}`);
        }
    }
    handleSuback(packet) {
        const unacknowledgedSubscribe = this.unacknowledgedSubscribes.get(packet.id);
        if (unacknowledgedSubscribe) {
            this.unacknowledgedSubscribes.delete(packet.id);
            let i = 0;
            for (const sub of unacknowledgedSubscribe.subscriptions){
                sub.state = 'acknowledged';
                sub.returnCode = packet.returnCodes[i++];
                const deferred = this.unresolvedSubscribes.get(sub.topicFilter);
                if (deferred) {
                    this.unresolvedSubscribes.delete(sub.topicFilter);
                    deferred.resolve(packet);
                }
            }
        } else {
            throw new Error(`received suback packet with unrecognized id ${packet.id}`);
        }
    }
    handleUnsuback(packet) {
        const unacknowledgedUnsubscribe = this.unacknowledgedUnsubscribes.get(packet.id);
        if (unacknowledgedUnsubscribe) {
            this.unacknowledgedUnsubscribes.delete(packet.id);
            for (const sub of unacknowledgedUnsubscribe.subscriptions){
                if (!sub) {
                    continue;
                }
                sub.state = 'unsubscribe-acknowledged';
                this.subscriptions = this.subscriptions.filter((s)=>s !== sub);
                const deferred = this.unresolvedUnsubscribes.get(sub.topicFilter);
                if (deferred) {
                    this.unresolvedUnsubscribes.delete(sub.topicFilter);
                    deferred.resolve(packet);
                }
            }
        } else {
            throw new Error(`received unsuback packet with unrecognized id ${packet.id}`);
        }
    }
    startConnectTimer() {
        this.startTimer('connect', ()=>{
            this.connectTimedOut();
        }, this.options.connectTimeout || defaultConnectTimeout);
    }
    connectTimedOut() {
        switch(this.connectionState){
            case 'connecting':
                break;
            default:
                throw new Error(`connect timer should not be timing out in ${this.connectionState} state`);
        }
        this.changeState('offline');
        this.close();
        this.notifyConnectRejected(new Error('connect timed out'));
        this.reconnectAttempt = 0;
        this.startReconnectTimer();
    }
    notifyConnectRejected(err) {
        if (this.unresolvedConnect) {
            this.log('rejecting initial connect');
            this.unresolvedConnect.reject(err);
        }
    }
    stopConnectTimer() {
        if (this.timerExists('connect')) {
            this.stopTimer('connect');
        }
    }
    startReconnectTimer() {
        const options = this.options;
        let reconnectOptions;
        let defaultOptions;
        if (!this.everConnected) {
            reconnectOptions = options.connect || {};
            defaultOptions = defaultConnectOptions;
        } else {
            reconnectOptions = options.reconnect || {};
            defaultOptions = defaultReconnectOptions;
        }
        if (reconnectOptions === false) {
            return;
        } else if (reconnectOptions === true) {
            reconnectOptions = {};
        }
        const attempt = this.reconnectAttempt;
        const maxAttempts = reconnectOptions.retries ?? defaultOptions.retries;
        if (attempt >= maxAttempts) {
            return false;
        }
        const min = reconnectOptions.minDelay ?? defaultOptions.minDelay;
        const max = reconnectOptions.maxDelay ?? defaultOptions.maxDelay;
        const factor = reconnectOptions.factor ?? defaultOptions.factor;
        const random = reconnectOptions.random ?? defaultOptions.random;
        const thisDelay = min * Math.pow(factor, attempt);
        const nextDelay = min * Math.pow(factor, attempt + 1);
        const diff = nextDelay - thisDelay;
        const randomness = random ? diff * Math.random() : 0;
        const delay = Math.floor(Math.min(thisDelay + randomness, max));
        this.log(`reconnect attempt ${attempt + 1} in ${delay}ms`);
        this.startTimer('reconnect', ()=>{
            this.reconnectAttempt++;
            this.openConnection();
        }, delay);
        return true;
    }
    stopReconnectTimer() {
        if (this.timerExists('reconnect')) {
            this.stopTimer('reconnect');
        }
    }
    startKeepAliveTimer() {
        if (!this.keepAlive) {
            return;
        }
        const elapsed = Date.now() - this.lastPacketTime.getTime();
        const timeout = this.keepAlive * 1000 - elapsed;
        this.startTimer('keepAlive', ()=>this.sendKeepAlive(), timeout);
    }
    stopKeepAliveTimer() {
        if (this.timerExists('keepAlive')) {
            this.stopTimer('keepAlive');
        }
    }
    async sendKeepAlive() {
        if (this.connectionState === 'connected') {
            const elapsed = Date.now() - this.lastPacketTime.getTime();
            const timeout = this.keepAlive * 1000;
            if (elapsed >= timeout) {
                await this.send({
                    type: 'pingreq'
                });
            }
            this.startKeepAliveTimer();
        } else {
            this.log('keepAliveTimer should have been cancelled');
        }
    }
    stopTimers() {
        this.stopConnectTimer();
        this.stopReconnectTimer();
        this.stopKeepAliveTimer();
    }
    startTimer(name, cb, delay) {
        if (this.timerExists(name)) {
            this.log(`timer ${name} already exists`);
            this.stopTimer(name);
        }
        this.log(`starting timer ${name} for ${delay}ms`);
        this.timers[name] = setTimeout(()=>{
            delete this.timers[name];
            this.log(`invoking timer ${name} callback`);
            cb();
        }, delay);
    }
    stopTimer(name) {
        if (!this.timerExists(name)) {
            this.log(`no timer ${name} to stop`);
            return;
        }
        this.log(`stopping timer ${name}`);
        const id = this.timers[name];
        if (id) {
            clearTimeout(id);
            delete this.timers[name];
        }
    }
    timerExists(name) {
        return !!this.timers[name];
    }
    changeState(newState) {
        const oldState = this.connectionState;
        this.connectionState = newState;
        this.log(`connectionState: ${oldState} -> ${newState}`);
        this.emit('statechange', {
            from: oldState,
            to: newState
        });
        this.emit(newState);
    }
    generateClientId() {
        let clientId;
        if (typeof this.options.clientId === 'string') {
            clientId = this.options.clientId;
        } else if (typeof this.options.clientId === 'function') {
            clientId = this.options.clientId();
        } else {
            const prefix = this.options.clientIdPrefix || defaultClientIdPrefix;
            const suffix = Math.random().toString(36).slice(2);
            clientId = `${prefix}-${suffix}`;
        }
        return clientId;
    }
    getURL() {
        let url = typeof this.options.url === 'function' ? this.options.url() : this.options.url;
        if (!url) {
            url = this.getDefaultURL();
        }
        if (typeof url === 'string') {
            url = this.parseURL(url);
        }
        const protocol = url.protocol.slice(0, -1);
        if (!url.port) {
            url.port = defaultPorts[protocol].toString();
        }
        this.validateURL(url);
        return url;
    }
    parseURL(url) {
        let parsed = new URL(url);
        if (!parsed.hostname && parsed.pathname.startsWith('//')) {
            const protocol = parsed.protocol;
            parsed = new URL(url.replace(protocol, 'http:'));
            parsed.protocol = protocol;
        }
        return parsed;
    }
    nextPacketId() {
        this.lastPacketId = (this.lastPacketId + 1) % packetIdLimit;
        if (!this.lastPacketId) {
            this.lastPacketId = 1;
        }
        return this.lastPacketId;
    }
    async send(packet) {
        this.log(`sending ${packet.type} packet`, packet);
        this.emit('packetsend', packet);
        const bytes = this.encode(packet);
        this.emit('bytessent', bytes);
        await this.write(bytes);
        this.lastPacketTime = new Date();
    }
    on(eventName, listener) {
        let listeners = this.eventListeners.get(eventName);
        if (!listeners) {
            listeners = [];
            this.eventListeners.set(eventName, listeners);
        }
        listeners.push(listener);
    }
    off(eventName, listener) {
        const listeners = this.eventListeners.get(eventName);
        if (listeners) {
            this.eventListeners.set(eventName, listeners.filter((l)=>l !== listener));
        }
    }
    emit(eventName, ...args) {
        const listeners = this.eventListeners.get(eventName);
        if (listeners) {
            for (const listener of listeners){
                listener(...args);
            }
        }
    }
}
class Deferred {
    promise;
    resolve;
    reject;
    constructor(){
        this.promise = new Promise((resolve, reject)=>{
            this.resolve = resolve;
            this.reject = reject;
        });
    }
}
const utf8Encoder = new TextEncoder();
const utf8Decoder = new TextDecoder();
class Client1 extends Client {
    conn;
    closing = false;
    constructor(options){
        super(options);
    }
    getDefaultURL() {
        return 'mqtt://localhost';
    }
    validateURL(url) {
        if (url.protocol !== 'mqtt:' && url.protocol !== 'mqtts:') {
            throw new Error(`URL protocol must be mqtt or mqtts`);
        }
    }
    async open(url) {
        let conn;
        if (url.protocol === 'mqtt:') {
            conn = await Deno.connect({
                hostname: url.hostname,
                port: Number(url.port)
            });
        } else if (url.protocol === 'mqtts:') {
            conn = await Deno.connectTls({
                hostname: url.hostname,
                port: Number(url.port),
                certFile: this.options.certFile
            });
        } else {
            throw new Error(`unknown URL protocol ${url.protocol.slice(0, -1)}`);
        }
        this.conn = conn;
        this.closing = false;
        (async ()=>{
            const buffer = new Uint8Array(4096);
            while(true){
                let bytesRead = null;
                try {
                    this.log('reading');
                    bytesRead = await conn.read(buffer);
                } catch (err) {
                    if (this.closing && err.name === 'BadResource') {} else {
                        this.log('caught error while reading', err);
                        this.connectionClosed();
                    }
                    break;
                }
                if (bytesRead === null) {
                    this.log('read stream closed');
                    this.connectionClosed();
                    break;
                }
                this.bytesReceived(buffer.slice(0, bytesRead));
            }
        })().then(()=>{}, ()=>{});
    }
    async write(bytes) {
        if (!this.conn) {
            throw new Error('no connection');
        }
        this.log('writing bytes', bytes);
        await this.conn.write(bytes);
    }
    async close() {
        if (!this.conn) {
            throw new Error('no connection');
        }
        this.closing = true;
        this.conn.close();
    }
    encode(packet) {
        return super.encode(packet, utf8Encoder);
    }
    decode(bytes) {
        return super.decode(bytes, utf8Decoder);
    }
}
class DenoStdInternalError extends Error {
    constructor(message){
        super(message);
        this.name = "DenoStdInternalError";
    }
}
function assert(expr, msg = "") {
    if (!expr) {
        throw new DenoStdInternalError(msg);
    }
}
const { hasOwn  } = Object;
function get(obj, key) {
    if (hasOwn(obj, key)) {
        return obj[key];
    }
}
function getForce(obj, key) {
    const v = get(obj, key);
    assert(v != null);
    return v;
}
function isNumber(x) {
    if (typeof x === "number") return true;
    if (/^0x[0-9a-f]+$/i.test(String(x))) return true;
    return /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(e[-+]?\d+)?$/.test(String(x));
}
function hasKey(obj, keys) {
    let o = obj;
    keys.slice(0, -1).forEach((key)=>{
        o = get(o, key) ?? {};
    });
    const key = keys[keys.length - 1];
    return hasOwn(o, key);
}
function parse(args, { "--": doubleDash = false , alias ={} , boolean: __boolean = false , default: defaults = {} , stopEarly =false , string =[] , collect =[] , negatable =[] , unknown =(i)=>i  } = {}) {
    const aliases = {};
    const flags = {
        bools: {},
        strings: {},
        unknownFn: unknown,
        allBools: false,
        collect: {},
        negatable: {}
    };
    if (alias !== undefined) {
        for(const key in alias){
            const val = getForce(alias, key);
            if (typeof val === "string") {
                aliases[key] = [
                    val
                ];
            } else {
                aliases[key] = val;
            }
            for (const alias1 of getForce(aliases, key)){
                aliases[alias1] = [
                    key
                ].concat(aliases[key].filter((y)=>alias1 !== y));
            }
        }
    }
    if (__boolean !== undefined) {
        if (typeof __boolean === "boolean") {
            flags.allBools = !!__boolean;
        } else {
            const booleanArgs = typeof __boolean === "string" ? [
                __boolean
            ] : __boolean;
            for (const key1 of booleanArgs.filter(Boolean)){
                flags.bools[key1] = true;
                const alias2 = get(aliases, key1);
                if (alias2) {
                    for (const al of alias2){
                        flags.bools[al] = true;
                    }
                }
            }
        }
    }
    if (string !== undefined) {
        const stringArgs = typeof string === "string" ? [
            string
        ] : string;
        for (const key2 of stringArgs.filter(Boolean)){
            flags.strings[key2] = true;
            const alias3 = get(aliases, key2);
            if (alias3) {
                for (const al1 of alias3){
                    flags.strings[al1] = true;
                }
            }
        }
    }
    if (collect !== undefined) {
        const collectArgs = typeof collect === "string" ? [
            collect
        ] : collect;
        for (const key3 of collectArgs.filter(Boolean)){
            flags.collect[key3] = true;
            const alias4 = get(aliases, key3);
            if (alias4) {
                for (const al2 of alias4){
                    flags.collect[al2] = true;
                }
            }
        }
    }
    if (negatable !== undefined) {
        const negatableArgs = typeof negatable === "string" ? [
            negatable
        ] : negatable;
        for (const key4 of negatableArgs.filter(Boolean)){
            flags.negatable[key4] = true;
            const alias5 = get(aliases, key4);
            if (alias5) {
                for (const al3 of alias5){
                    flags.negatable[al3] = true;
                }
            }
        }
    }
    const argv = {
        _: []
    };
    function argDefined(key, arg) {
        return flags.allBools && /^--[^=]+$/.test(arg) || get(flags.bools, key) || !!get(flags.strings, key) || !!get(aliases, key);
    }
    function setKey(obj, name, value, collect = true) {
        let o = obj;
        const keys = name.split(".");
        keys.slice(0, -1).forEach(function(key) {
            if (get(o, key) === undefined) {
                o[key] = {};
            }
            o = get(o, key);
        });
        const key = keys[keys.length - 1];
        const collectable = collect && !!get(flags.collect, name);
        if (!collectable) {
            o[key] = value;
        } else if (get(o, key) === undefined) {
            o[key] = [
                value
            ];
        } else if (Array.isArray(get(o, key))) {
            o[key].push(value);
        } else {
            o[key] = [
                get(o, key),
                value
            ];
        }
    }
    function setArg(key, val, arg = undefined, collect) {
        if (arg && flags.unknownFn && !argDefined(key, arg)) {
            if (flags.unknownFn(arg, key, val) === false) return;
        }
        const value = !get(flags.strings, key) && isNumber(val) ? Number(val) : val;
        setKey(argv, key, value, collect);
        const alias = get(aliases, key);
        if (alias) {
            for (const x of alias){
                setKey(argv, x, value, collect);
            }
        }
    }
    function aliasIsBoolean(key) {
        return getForce(aliases, key).some((x)=>typeof get(flags.bools, x) === "boolean");
    }
    let notFlags = [];
    if (args.includes("--")) {
        notFlags = args.slice(args.indexOf("--") + 1);
        args = args.slice(0, args.indexOf("--"));
    }
    for(let i = 0; i < args.length; i++){
        const arg = args[i];
        if (/^--.+=/.test(arg)) {
            const m = arg.match(/^--([^=]+)=(.*)$/s);
            assert(m != null);
            const [, key5, value] = m;
            if (flags.bools[key5]) {
                const booleanValue = value !== "false";
                setArg(key5, booleanValue, arg);
            } else {
                setArg(key5, value, arg);
            }
        } else if (/^--no-.+/.test(arg) && get(flags.negatable, arg.replace(/^--no-/, ""))) {
            const m1 = arg.match(/^--no-(.+)/);
            assert(m1 != null);
            setArg(m1[1], false, arg, false);
        } else if (/^--.+/.test(arg)) {
            const m2 = arg.match(/^--(.+)/);
            assert(m2 != null);
            const [, key6] = m2;
            const next = args[i + 1];
            if (next !== undefined && !/^-/.test(next) && !get(flags.bools, key6) && !flags.allBools && (get(aliases, key6) ? !aliasIsBoolean(key6) : true)) {
                setArg(key6, next, arg);
                i++;
            } else if (/^(true|false)$/.test(next)) {
                setArg(key6, next === "true", arg);
                i++;
            } else {
                setArg(key6, get(flags.strings, key6) ? "" : true, arg);
            }
        } else if (/^-[^-]+/.test(arg)) {
            const letters = arg.slice(1, -1).split("");
            let broken = false;
            for(let j = 0; j < letters.length; j++){
                const next1 = arg.slice(j + 2);
                if (next1 === "-") {
                    setArg(letters[j], next1, arg);
                    continue;
                }
                if (/[A-Za-z]/.test(letters[j]) && /=/.test(next1)) {
                    setArg(letters[j], next1.split(/=(.+)/)[1], arg);
                    broken = true;
                    break;
                }
                if (/[A-Za-z]/.test(letters[j]) && /-?\d+(\.\d*)?(e-?\d+)?$/.test(next1)) {
                    setArg(letters[j], next1, arg);
                    broken = true;
                    break;
                }
                if (letters[j + 1] && letters[j + 1].match(/\W/)) {
                    setArg(letters[j], arg.slice(j + 2), arg);
                    broken = true;
                    break;
                } else {
                    setArg(letters[j], get(flags.strings, letters[j]) ? "" : true, arg);
                }
            }
            const [key7] = arg.slice(-1);
            if (!broken && key7 !== "-") {
                if (args[i + 1] && !/^(-|--)[^-]/.test(args[i + 1]) && !get(flags.bools, key7) && (get(aliases, key7) ? !aliasIsBoolean(key7) : true)) {
                    setArg(key7, args[i + 1], arg);
                    i++;
                } else if (args[i + 1] && /^(true|false)$/.test(args[i + 1])) {
                    setArg(key7, args[i + 1] === "true", arg);
                    i++;
                } else {
                    setArg(key7, get(flags.strings, key7) ? "" : true, arg);
                }
            }
        } else {
            if (!flags.unknownFn || flags.unknownFn(arg) !== false) {
                argv._.push(flags.strings["_"] ?? !isNumber(arg) ? arg : Number(arg));
            }
            if (stopEarly) {
                argv._.push(...args.slice(i + 1));
                break;
            }
        }
    }
    for (const [key8, value1] of Object.entries(defaults)){
        if (!hasKey(argv, key8.split("."))) {
            setKey(argv, key8, value1);
            if (aliases[key8]) {
                for (const x of aliases[key8]){
                    setKey(argv, x, value1);
                }
            }
        }
    }
    for (const key9 of Object.keys(flags.bools)){
        if (!hasKey(argv, key9.split("."))) {
            const value2 = get(flags.collect, key9) ? [] : false;
            setKey(argv, key9, value2, false);
        }
    }
    for (const key10 of Object.keys(flags.strings)){
        if (!hasKey(argv, key10.split(".")) && get(flags.collect, key10)) {
            setKey(argv, key10, [], false);
        }
    }
    if (doubleDash) {
        argv["--"] = [];
        for (const key11 of notFlags){
            argv["--"].push(key11);
        }
    } else {
        for (const key12 of notFlags){
            argv._.push(key12);
        }
    }
    return argv;
}
function logger(msg) {
    console.log(new Date().toLocaleString() + " - " + msg);
}
function logAndExit(msg, retCode) {
    logger(msg);
    Deno.exit(retCode);
}
const defaultConfig = {
    host: undefined,
    port: undefined,
    topic: "homeassistant/sensor/",
    entity: "spotprice",
    area: "SE2",
    currency: "SEK",
    decimals: 5,
    factor: 1,
    extra: 0,
    connectionTimeoutMs: 20 * 1000
};
const config = parse(Deno.args, {
    default: defaultConfig
});
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
config.topic = config.topic.toLowerCase().trim();
config.entity = config.entity.toLowerCase().trim();
config.currency = config.currency.toUpperCase().trim();
config.area = config.area.toUpperCase().trim();
config.decimals = parseInt(config.decimals, 10), config.factor = parseFloat(config.factor);
config.extra = parseFloat(config.extra);
function findPriceAt(result, targetDate) {
    for (const row of result){
        if (row.time <= targetDate && new Date(row.time.getTime() + 3600 * 1000) > targetDate) {
            return row.price;
        }
    }
}
function avgPriceBetween(result, date, offsetFrom, offsetTo) {
    let sum = 0, count = 0;
    const from = new Date(date.getTime() + offsetFrom), to = new Date(date.getTime() + offsetTo);
    for (const row of result){
        if (row.time >= from && row.time <= to) {
            sum += row.price;
            count++;
        }
    }
    return sum / count;
}
function findMinMaxPriceAtDate(result, targetDate) {
    let maxTime, maxVal = -Infinity;
    let minTime, minVal = Infinity;
    for (const row of result){
        if ((row.time <= targetDate && row.time + 3600 * 1000 > targetDate || row.time > targetDate) && targetDate.toLocaleDateString() == row.time.toLocaleDateString()) {
            if (maxVal === undefined || maxVal < row.price) {
                maxVal = row.price;
                maxTime = row.time;
            }
            if (minVal > row.price) {
                minVal = row.price;
                minTime = row.time;
            }
        }
    }
    return {
        maxVal: maxVal === -Infinity ? null : maxVal,
        minVal: minVal === Infinity ? null : minVal,
        maxTime: maxTime ? maxTime.toISOString() : "",
        minTime: minTime ? minTime.toISOString() : ""
    };
}
const spotprice = async (area, currency, inDate)=>{
    const baseUrl = "https://spot.56k.guru/api/v2", entsoeEndpoint = "/spot", params = {
        period: "hourly",
        startDate: inDate.toLocaleDateString('sv-SE'),
        endDate: inDate.toLocaleDateString('sv-SE'),
        area,
        currency
    }, entsoeUrl = `${baseUrl}${entsoeEndpoint}?${new URLSearchParams(params)}`, entsoeResult = await fetch(entsoeUrl), entsoeJson = await entsoeResult.json();
    entsoeJson.data = entsoeJson.data.map(({ time , price  })=>{
        return {
            time: new Date(Date.parse(time)),
            price
        };
    });
    return entsoeJson.data;
};
const oneHourMs = 3600 * 1000, oneDayMs = oneHourMs * 24;
let client;
try {
    const connectionTimeout = setTimeout(()=>{
        if (connectionTimeout) {
            logger("Connection timed out");
            Deno.exit(1);
        }
    }, config.connectionTimeoutMs);
    client = new Client1({
        url: `mqtt://${config.host}:${config.port}`
    });
    await client.connect();
    clearTimeout(connectionTimeout);
} catch (e) {
    logAndExit("failed to connect " + e.toString(), 1);
}
let result;
try {
    result = [
        ...await spotprice(config.area, config.currency, new Date(new Date().getTime() - oneDayMs)),
        ...await spotprice(config.area, config.currency, new Date()),
        ...await spotprice(config.area, config.currency, new Date(new Date().getTime() + oneDayMs))
    ];
} catch (e1) {
    logAndExit("failed to fetch " + e1.toString(), 1);
}
async function publishDevice(name, id, state, type) {
    if (type !== "json") {
        logger("publishing " + name + " " + state);
    } else {
        logger("publishing " + name + " [json]");
    }
    const stateTopic = config.topic + id + "/state", attributesTopic = config.topic + id + "/attributes", configTopic = config.topic + id + "/config";
    let deviceConfig;
    if (type === "monetary") {
        deviceConfig = {
            device_class: "monetary",
            name: name,
            state_topic: stateTopic,
            unit_of_measurement: config.currency + "/kWh",
            object_id: id
        };
    } else if (type === "json") {
        deviceConfig = {
            name: name,
            state_topic: stateTopic,
            json_attributes_topic: attributesTopic,
            object_id: id
        };
    } else {
        deviceConfig = {
            name: name,
            state_topic: stateTopic,
            object_id: id
        };
    }
    const publishOpts = {
        retain: true
    };
    try {
        await client.publish(configTopic, JSON.stringify(deviceConfig), publishOpts);
        if (type == "json") {
            await client.publish(stateTopic, "", publishOpts);
            await client.publish(attributesTopic, state, publishOpts);
        } else {
            await client.publish(stateTopic, state, publishOpts);
        }
        await client.publish(stateTopic, state, publishOpts);
    } catch (e) {
        logger("failed to publish " + e.toString());
        Deno.exit(1);
    }
}
const dateToday = new Date(new Date().getTime());
dateToday.setHours(0);
dateToday.setMinutes(0);
dateToday.setSeconds(0);
const dateTomorrow = new Date(dateToday.getTime() + oneDayMs + 7200 * 1000);
dateTomorrow.setHours(0);
dateTomorrow.setMinutes(0);
dateTomorrow.setSeconds(0);
function preparePrice(price) {
    if (price !== null) {
        price = (price / 1000 + config.extra) * config.factor;
        return price ? price.toFixed(config.decimals) : "";
    } else {
        return "";
    }
}
const extremesToday = findMinMaxPriceAtDate(result, new Date()), extremesTomorrow = findMinMaxPriceAtDate(result, dateTomorrow);
await publishDevice("Spot price now", config.entity + "_now", preparePrice(findPriceAt(result, new Date())), "monetary");
await publishDevice("Spot price in 1 hour", config.entity + "_1h", preparePrice(findPriceAt(result, new Date(new Date().getTime() + oneHourMs))), "monetary");
await publishDevice("Spot price in 6 hours", config.entity + "_6h", preparePrice(findPriceAt(result, new Date(new Date().getTime() + oneHourMs * 6))), "monetary");
await publishDevice("Spot price in 12 hours", config.entity + "_12h", preparePrice(findPriceAt(result, new Date(new Date().getTime() + oneHourMs * 12))), "monetary");
await publishDevice("Highest upcomping spot price today ", config.entity + "_today_max", preparePrice(extremesToday.maxVal), "monetary");
await publishDevice("Highest upcomping spot price today time", config.entity + "_today_max_time", extremesToday.maxTime, "datetime");
await publishDevice("Lowest upcomping spot price today", config.entity + "_today_min", preparePrice(extremesToday.minVal), "monetary");
await publishDevice("Lowest upcomping spot price today time", config.entity + "_today_min_time", extremesToday.minTime, "datetime");
await publishDevice("Highest upcomping spot price tomorrow", config.entity + "_tomorrow_max", preparePrice(extremesTomorrow.maxVal), "monetary");
await publishDevice("Highest upcomping spot price tomorrow time", config.entity + "_tomorrow_max_time", extremesTomorrow.maxTime, "datetime");
await publishDevice("Lowest upcomping spot price tomorrow", config.entity + "_tomorrow_min", preparePrice(extremesTomorrow.minVal), "monetary");
await publishDevice("Lowest upcomping spot price tomorrow time", config.entity + "_tomorrow_min_time", extremesTomorrow.minTime, "datetime");
await publishDevice("Average spot price today", config.entity + "_avg", preparePrice(avgPriceBetween(result, dateToday, 0, oneHourMs * 24)), "monetary");
await publishDevice("Average spot price today night", config.entity + "_night_avg", preparePrice(avgPriceBetween(result, dateToday, 0, oneHourMs * 6)), "monetary");
await publishDevice("Average spot price today morning", config.entity + "_morning_avg", preparePrice(avgPriceBetween(result, dateToday, oneHourMs * 6, oneHourMs * 12)), "monetary");
await publishDevice("Average spot price today afternoon", config.entity + "_afternoon_avg", preparePrice(avgPriceBetween(result, dateToday, oneHourMs * 12, oneHourMs * 18)), "monetary");
await publishDevice("Average spot price today evening", config.entity + "_evening_avg", preparePrice(avgPriceBetween(result, dateToday, oneHourMs * 18, oneHourMs * 24)), "monetary");
await publishDevice("Average spot price tomorrow", config.entity + "_tomorrow_avg", preparePrice(avgPriceBetween(result, dateTomorrow, 0, oneHourMs * 24)), "monetary");
await publishDevice("Average spot price tomorrow night", config.entity + "_tomorrow_night_avg", preparePrice(avgPriceBetween(result, dateTomorrow, 0, oneHourMs * 6)), "monetary");
await publishDevice("Average spot price tomorrow morning", config.entity + "_tomorrow_morning_avg", preparePrice(avgPriceBetween(result, dateTomorrow, oneHourMs * 6, oneHourMs * 12)), "monetary");
await publishDevice("Average spot price tomorrow afternoon", config.entity + "_tomorrow_afternoon_avg", preparePrice(avgPriceBetween(result, dateTomorrow, oneHourMs * 12, oneHourMs * 18)), "monetary");
await publishDevice("Average spot price tomorrow evening", config.entity + "_tomorrow_evening_avg", preparePrice(avgPriceBetween(result, dateTomorrow, oneHourMs * 18, oneHourMs * 24)), "monetary");
await publishDevice("Spot price data", config.entity + "_data", JSON.stringify({
    history: result.map((r)=>{
        return {
            st: r.time,
            p: preparePrice(r.price)
        };
    })
}), "json");
await client.disconnect();
