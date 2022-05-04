import * as mqtt from "mqtt";
import {waitFor} from "wait-for-event";
import * as genUUID from "uuid";
import * as crypto from "crypto";

let pathHandler=new Map();
const globalKey="key";

let client=mqtt.connect("mqtts://Test:Test123456@mqtt.had.xin?clientId=test");
client.on('message',(topic, message)=>{
    let messageJson=JSON.parse(message.toString());
    console.log("[MqttClient]Message arrived, topic:",topic,",message:",messageJson);
    if(pathHandler.has(topic)) {
        let handlers=pathHandler.get(topic);
        handlers.forEach((handler)=>{
            handler(messageJson);
        })
    }
});
client.addHandler=(topic, cb)=>{
    if(!pathHandler.has(topic)) {
        pathHandler.set(topic, []);
        client.subscribe(topic);
    }
    pathHandler.get(topic).push(cb);
}
client.removeHandler=(topic, cb)=>{
    if(!pathHandler.has(topic)) return false;
    let cbs=pathHandler.get(topic);
    if(cbs.includes(cb)) {
        cbs.remove(cb);
    }
}

await waitFor('connect',client);

const uuid=genUUID.v4();
const regIdObj={
    "jsonrpc": 2.0,
    "method": "regId",
    "params": [uuid],
    "id" : crypto.randomBytes(8).toString('hex')
};

let componentInfo={
    name: "test",
    version: "1.0.0",
    authKey: globalKey
};

client.addHandler("panel/component/"+uuid, (req)=>{
    let result;
    switch (req.method) {
        case "getComponentInfo": result=componentInfo; break;
        case "heartBeat": {
            const getSha1Hex=(str)=>{
                return crypto.createHash('sha256').update(str).digest('hex');
            }
            result=getSha1Hex(globalKey + req["params"][0]);
            console.log(req["params"][0],result);
        }
        break;
    }
    let res={
        "jsonrpc": 2.0,
        "result": result,
        "id": req.id
    }
    client.publish("panel/component/response/"+uuid+"/"+res.id, JSON.stringify(res));
});

client.publish("panel/regId", JSON.stringify(regIdObj));
