
const MongoClient = require('mongodb').MongoClient;
const uri = process.env.MONGODB_URI
// const uri = "mongodb+srv://lexliveslife:F%40ceb00k%21@centralbdc-im3cl.mongodb.net/test?retryWrites=true";
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
client.connect()
const bodyParser = require('body-parser')

const axios = require("axios")

// in sublime
var express = require("express");
var port = process.env.PORT || 3001;
var cors = require('cors');
var app = express();
// app.use(express.json()) 
app.use(cors())
app.use(bodyParser.json({ limit: '5mb' }));
// app.use(express.bodyParser.urlencoded({limit: '50mb', extended: true}));
const ObjectID = require('mongodb').ObjectID;
const timeout = (ms) => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve()
        }, ms);
    })
}
app.post('/findOne', async function (req, res) {
    let query = req.body.query
    if (query._id != undefined) {
        query._id = new ObjectID(query._id)
    }
    let collection = await client.db("CentralBDC").collection(req.body.collection);
    collection = await collection.findOne(query).catch((err) => console.log(err))
    res.send(collection);
});

app.post('/findOneAndUpdate', async function (req, res) {
    let query = req.body.query
    if (query._id != undefined) {
        query._id = new ObjectID(query._id)
    }
    let update = req.body.update
    if (update._id != undefined) {
        update._id = new ObjectID(update._id)
    }
    let collection = await client.db("CentralBDC").collection(req.body.collection);
    let item = await collection.findOne(query).catch((err) => { console.log(err) })
    item = Object.assign(item, update)
    collection = await collection.findOneAndUpdate(query, { $set: item }).catch((err) => { console.log(err) })
    res.send(collection)
})
app.post('/findOneAndDelete', async function (req, res) {
    let query = req.body.query
    if (query._id != undefined) {
        query._id = new ObjectID(query._id)
    }
    let collection = await client.db("CentralBDC").collection(req.body.collection);
    collection = await collection.findOneAndDelete(query).catch((err) => { console.log(err) })
    res.send(collection)
})
app.post('/find', async function (req, res) {
    let query = req.body.query || {}

    let collection = await client.db("CentralBDC").collection(req.body.collection);
    collection = await collection.find(query).toArray()
    res.send(collection)
})

app.post('/insertOne', async function (req, res) {

    let collection = await client.db("CentralBDC").collection(req.body.collection);
    collection = await collection.insertOne(req.body.item)
    res.send(collection)
})

app.post('/getToken', async function (req, res) {
    let token = await axios.post("https://webhooks.mongodb-stitch.com/api/client/v2.0/app/centralbdc-bwpmi/service/RingCentral/incoming_webhook/gettoken")
    token = token.data
    res.send(token)


})

app.post('/sendGroupText', async function (req, res) {
    let { toNumber, fromNumber, token } = req.query
    let { text } = req.body
    let result = await axios.post(`https://webhooks.mongodb-stitch.com/api/client/v2.0/app/centralbdc-bwpmi/service/RingCentral/incoming_webhook/sendsms?toNumber=${toNumber}&fromNumber=${fromNumber}&token=${token}`,
        {
            text
        })
    res.send(result.data)

})
app.get("/callsForMonth", async function (req, res) {
    let { access_token, phoneNumber, month, year, page } = req.query;
    let url = `https://webhooks.mongodb-stitch.com/api/client/v2.0/app/centralbdc-bwpmi/service/RingCentral/incoming_webhook/callLog?access_token=${access_token}&phoneNumber=${phoneNumber}&month=${month}&year=${year}&page=${page}`
    let result = await axios.get(url)
    res.send(result.data);
})
app.get("/updateRecordsThisMonth", async function (req, res) {
    let dealerships = await axios.post("http://guarded-castle-33109.herokuapp.com/find", { "collection": "dealerships" })
    dealerships = dealerships.data;

    let lastMonthRecords = []
    let thisMonthRecords = []
    let lastMonth = new Date()
    lastMonth.setMonth(new Date().getMonth() - 1)
    for (let d in dealerships) {
        let { dataMining, sales } = dealerships[d];
        if (dataMining.length !== 12 || sales.length !== 12) {
            console.log("numbers bad", dealerships[d].label)
            continue;
        }
        console.log(dealerships[d].label, dealerships[d]._id)
        let stop = false;
        lastMonthRecords = [];
        thisMonthRecords = [];
        let page = 1;
        while (!stop) {
            let voice_token = await axios.post("http://guarded-castle-33109.herokuapp.com/findOne", { "collection": "utils", "query": { _id: "5df2b825f195a16a1dbd4bf5" } })
            voice_token = voice_token.data.voice_token;

            let url = `https://platform.ringcentral.com/restapi/v1.0/account/~/call-log?access_token=${voice_token}&phoneNumber=${dealerships[d].dataMining.substring(1, 11)}&view=Detailed&dateFrom=2019-12-01&dateTo=2020-01-01&perPage=1000&page=${page}`
            // let url = `https://webhooks.mongodb-stitch.com/api/client/v2.0/app/centralbdc-bwpmi/service/RingCentral/incoming_webhook/callLog?access_token=${voice_token}&phoneNumber=${dealerships[d].dataMining.substring(1, 11)}&month=${lastMonth.getMonth() + 1}&year=${lastMonth.getFullYear()}&page=${page}`
            //get all pages of dataminig (last month)
            let currRecords = await axios.get(url);
            console.log(currRecords.data.records.length)
            if (!currRecords.data.records) {
                console.log(dealerships[d].label)
                stop = true;
                continue;
            }
            thisMonthRecords = thisMonthRecords.concat(currRecords.data.records)
            stop = currRecords.data.records.length !== 1000;
            page++;
            await timeout(7000);
        }
        stop = false;
        page = 1;
        while (!stop) {
            let voice_token = await axios.post("http://guarded-castle-33109.herokuapp.com/findOne", { "collection": "utils", "query": { _id: "5df2b825f195a16a1dbd4bf5" } })
            voice_token = voice_token.data.voice_token;

            let url = `https://platform.ringcentral.com/restapi/v1.0/account/~/call-log?access_token=${voice_token}&phoneNumber=${dealerships[d].sales.substring(1, 11)}&view=Detailed&dateFrom=2019-12-01&dateTo=2020-01-01&perPage=1000&page=${page}`
            // let url = `https://webhooks.mongodb-stitch.com/api/client/v2.0/app/centralbdc-bwpmi/service/RingCentral/incoming_webhook/callLog?access_token=${voice_token}&phoneNumber=${dealerships[d].dataMining.substring(1, 11)}&month=${lastMonth.getMonth() + 1}&year=${lastMonth.getFullYear()}&page=${page}`
            //get all pages of dataminig (last month)
            let currRecords = await axios.get(url);
            console.log(currRecords.data.records.length)
            if (!currRecords.data.records) {
                console.log(dealerships[d].label)
                stop = true;
                continue;
            }
            thisMonthRecords = thisMonthRecords.concat(currRecords.data.records)
            stop = currRecords.data.records.length !== 1000;
            page++;
            await timeout(7000);
        }
        console.log("THIS COUNT", thisMonthRecords.length)
        await axios.post("http://localhost:3001/findOneAndUpdate", {
            collection: "recordings",
            query: {
                dealership: dealerships[d].value
            },
            update: {
                dealership: dealerships[d].value,
                thisMonthCount: thisMonthRecords.length
            }
        })
        // console.log("THIS", thisMonthRecords.length)
        // console.log("last", lastMonthRecords.length)
        // console.log("this", thisMonthRecords.length)
        console.log(d)
    }
    res.send({ result: "done" })
})
app.get("/updateRecordsLastMonth", async function (req, res) {
    let dealerships = await axios.post("http://guarded-castle-33109.herokuapp.com/find", { "collection": "dealerships" })
    dealerships = dealerships.data;

    let lastMonthRecords = []
    let thisMonthRecords = []
    let lastMonth = new Date()
    lastMonth.setMonth(new Date().getMonth() - 1)
    for (let d in dealerships) {
        let { dataMining, sales } = dealerships[d];
        if (dataMining.length !== 12 || sales.length !== 12) {
            console.log("numbers bad", dealerships[d].label)
            continue;
        }
        console.log(dealerships[d].label, dealerships[d]._id)
        let stop = false;
        lastMonthRecords = [];
        thisMonthRecords = [];
        let page = 1;
        while (!stop) {
            let voice_token = await axios.post("http://guarded-castle-33109.herokuapp.com/findOne", { "collection": "utils", "query": { _id: "5df2b825f195a16a1dbd4bf5" } })
            voice_token = voice_token.data.voice_token;

            let url = `https://platform.ringcentral.com/restapi/v1.0/account/~/call-log?access_token=${voice_token}&phoneNumber=${dealerships[d].dataMining.substring(1, 11)}&view=Detailed&dateFrom=2019-11-01&dateTo=2019-12-01&perPage=1000&page=${page}`
            // let url = `https://webhooks.mongodb-stitch.com/api/client/v2.0/app/centralbdc-bwpmi/service/RingCentral/incoming_webhook/callLog?access_token=${voice_token}&phoneNumber=${dealerships[d].dataMining.substring(1, 11)}&month=${lastMonth.getMonth() + 1}&year=${lastMonth.getFullYear()}&page=${page}`
            //get all pages of dataminig (last month)
            let currRecords = await axios.get(url);
            console.log(currRecords.data.records.length)
            if (!currRecords.data.records) {
                console.log(dealerships[d].label)
                stop = true;
                continue;
            }
            lastMonthRecords = lastMonthRecords.concat(currRecords.data.records)
            stop = currRecords.data.records.length !== 1000;
            page++;
            await timeout(7000);
        }
        stop = false;
        page = 1;
        while (!stop) {
            let voice_token = await axios.post("http://guarded-castle-33109.herokuapp.com/findOne", { "collection": "utils", "query": { _id: "5df2b825f195a16a1dbd4bf5" } })
            voice_token = voice_token.data.voice_token;

            let url = `https://platform.ringcentral.com/restapi/v1.0/account/~/call-log?access_token=${voice_token}&phoneNumber=${dealerships[d].sales.substring(1, 11)}&view=Detailed&dateFrom=2019-11-01&dateTo=2019-12-01&perPage=1000&page=${page}`
            // let url = `https://webhooks.mongodb-stitch.com/api/client/v2.0/app/centralbdc-bwpmi/service/RingCentral/incoming_webhook/callLog?access_token=${voice_token}&phoneNumber=${dealerships[d].dataMining.substring(1, 11)}&month=${lastMonth.getMonth() + 1}&year=${lastMonth.getFullYear()}&page=${page}`
            //get all pages of dataminig (last month)
            let currRecords = await axios.get(url);
            console.log(currRecords.data.records.length)
            if (!currRecords.data.records) {
                console.log(dealerships[d].label)
                stop = true;
                continue;
            }
            lastMonthRecords = lastMonthRecords.concat(currRecords.data.records)
            stop = currRecords.data.records.length !== 1000;
            page++;
            await timeout(7000);
        }
        console.log("LAST COUNT", lastMonthRecords.length)
        await axios.post("http://localhost:3001/findOneAndUpdate", {
            collection: "recordings",
            query: {
                dealership: dealerships[d].value
            },
            update: {
                dealership: dealerships[d].value,
                lastMonthCount: lastMonthRecords.length
            }
        })
        console.log(d)
    }
    res.send({ result: "done" })
})
app.post("/leadData", async function (req, res) {
    let { body } = req
    for(let b in body.rules){
        body.rules[b] = body.rules[b].trim();
    }
    let collection = await client.db("CentralBDC").collection("leads");
    collection = await collection.insertOne(body)
    res.send(body)
})
app.listen(port, function () {
    console.log(`Example app listening on port ${port}!`);
});
