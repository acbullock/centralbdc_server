
const MongoClient = require('mongodb').MongoClient;
//get env vars from heroku for local stuff..
const uri = process.env.MONGODB_URI
const key = process.env.JWT_KEY
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
client.connect()
const bodyParser = require('body-parser')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const axios = require("axios")
const ObjectID = require('mongodb').ObjectID;
// in sublime
var express = require("express");
var port = process.env.PORT || 3001;
var parseString = require('xml2js').parseString;
var cors = require('cors');
var app = express();
// app.use(express.json()) 
let findByCredentials = async (username, password) => {
    let collection = await client.db("CentralBDC").collection("mojo_users");
    const user = await collection.findOne({ username })
    if (!user) {
        throw new Error({ error: 'username not found' });
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password)
    if (!isPasswordMatch) {
        throw new Error({ error: 'Invalid Password' })
    }
    return user;
}
let generateAuthToken = async (user) => {
    try {

        let token = jwt.sign({ _id: user._id }, key)
        let collection = await client.db("CentralBDC").collection("mojo_users");
        await collection.findOneAndUpdate({ username: user.username }, { "$push": { tokens: token } })
        return token;
    } catch (error) {
        return error.message
    }
}
const auth = async (req, res, next) => {
    let token = req.header('Authorization') !== undefined ? req.header('Authorization').replace('Bearer ', '') : null
    let data = null;
    try {
        data = jwt.verify(token, key)
    } catch (error) {
        res.status(401).send(error.message)
        return;
    }
    try {
        let collection = await client.db("CentralBDC").collection("mojo_users");
        let user = await collection.findOne({ _id: new ObjectID(data._id), tokens: token })
        if (!user) {
            throw new Error()
        }
        req.user = user
        req.token = token
        next()
    } catch (error) {
        res.status(401).send({ error: 'Not authorized to access this resource' })
        return;
    }
    return data;
}

const getValue = (obj) => {

    if (!obj) return ""
    let value = ""
    obj[0]._ ? value = obj[0]._ : value = obj[0]
    return value;
}
const getName = (name) => {
    if (!Array.isArray(name)) { return }
    let first = ""
    let last = ""
    for (let i in name) {
        if (name[i].$.part === "last") {
            last = name[i]._
        }
        if (name[i].$.part === "first") {
            first = name[i]._
        }
    }


    return { first, last }
}
const getOptions = (options) => {
    if (!Array.isArray(options)) {
        return []
    }
    else {
        let arr = []
        for (let o in options) {
            if (!options[o].optionname) continu
            arr.push(options[o].optionname[0])
        }
        return arr
    }
}
app.use(cors())
app.use(bodyParser.json({ limit: '5mb' }));
// app.use(express.bodyParser.urlencoded({limit: '50mb', extended: true}));
const timeout = (ms) => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve()
        }, ms);
    })
}
app.post('/findOne', async function (req, res) {
    let query = req.body.query || {}
    let options = req.body.options || {}
    if (query._id != undefined) {
        query._id = new ObjectID(query._id)
    }
    let collection = await client.db("CentralBDC").collection(req.body.collection);
    collection = await collection.findOne(query, options).catch((err) => console.log(err))
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
    let options = req.body.options || {}
    let collection = await client.db("CentralBDC").collection(req.body.collection);
    collection = await collection.find(query, options).toArray()
    res.send(collection)
})
app.post('/count', async function (req, res) {
    let query = req.body.query || {}
    let collection = await client.db("CentralBDC").collection(req.body.collection);
    let count = await collection.countDocuments(query)
    res.send({ count })
})
app.post('/insertOne', async function (req, res) {

    let collection = await client.db("CentralBDC").collection(req.body.collection);
    try {
        collection = await collection.insertOne(req.body.item)
    } catch (error) {
        res.status(400).send({ error: error.errmsg })
        return;
    }

    res.send(collection)
})
app.post('/aggregate', async function (req, res) {
    let pipeline = req.body.pipeline || {}
    let options = req.body.options || {}
    let coll = req.body.collection
    let collection = await client.db("CentralBDC").collection(coll);
    try {
        collection = await collection.aggregate(pipeline, options).toArray()
    } catch (error) {
        // res.status(400).send(error.errmsg)
        res.status(400).send({ error: error.errmsg })
        return;
    }
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
    // for(let b in body.rules){
    //     body.rules[b] = body.rules[b].trim();
    // }
    let collection = await client.db("CentralBDC").collection("leads");
    collection = await collection.insertOne(body)
    res.send(body)
})
app.post("/mojoLogin", async (req, res) => {
    //log in a registered user..
    try {
        const { username, password } = req.body;
        const user = await findByCredentials(username, password).catch(err => { })
        if (!user) {
            return res.status(401).send({ error: "Login failed." })
        }
        const token = await generateAuthToken(user)
        res.send(token)
    } catch (error) {
        res.status(400).send(error)
    }
})
app.get("/dealerProfiles", auth, async (req, res) => {
    let collection = await client.db("CentralBDC").collection("mojo_dealership_profiles");
    collection = await collection.find({ mojoActive: true }).toArray();
    res.send(collection)
})
app.get("/dealerProfiles/:id", auth, async (req, res) => {
    let id = req.params.id
    let collection = await client.db("CentralBDC").collection("mojo_dealership_profiles");
    collection = await collection.findOne({ mojoActive: true, _id: new ObjectID(id) })
    if (!collection) {
        res.status(404).send("profile not found")
    }
    res.send(collection)
})
app.post("/engagedLead", auth, async (req, res) => {
    let { body } = req;
    let user_profile_id = body.user_profile_id || {}
    let origin = body.origin || {}

    let first_name = body.first_name || ""
    let last_name = body.last_name || ""
    let phone_number = body.phone_number || ""
    let email = body.email || ""
    let postal_code = body.postal_code || ""
    let financing = body.financing || {}

    let vehicle = body.vehicle || {}

    let trade_in_vehicle = body.trade_in_vehicle || {}

    let contact_preference = body.contact_preference || ""
    let contact_time_preference = body.contact_time_preference || ""
    let adf_prospect_comments = body.adf_prospect_comments
    let user_info = body.user_info || {}
    let experiment = body.experiment || {}
    let dealership_id = body.dealership_id || ""
    let transcript = body.transcript || ""
    let mojo_score = body.mojo_score || -1
    let recommended_action = body.recommended_action || ""
    let is_test = body.is_test
    if (is_test === undefined) { is_test = false }
    let record = {
        user_profile_id,
        origin,
        first_name,
        last_name,
        phone_number,
        email,
        postal_code,
        financing,
        vehicle,
        trade_in_vehicle,
        adf_prospect_comments,
        contact_preference,
        contact_time_preference,
        user_info,
        experiment,
        dealership_id,
        transcript,
        mojo_score,
        recommended_action,
        is_test
    }
    let collection = await client.db("CentralBDC").collection("mojo_leads");
    try {
        collection.insertOne(record)
    } catch (error) {
        res.status(400).send(err)
        return;
    }

    res.send(record)

})
app.post("/adfToMojo", async (req, res) => {
    let { _id, adf } = req.body
    //accepts leads, and converts to mojo request
    parseString(adf, function (err, result) {
        let mojo_request = {
            user_profile_id: _id
        }
        let adf = result.adf
        if (!adf) {
            console.log("no adf in xml")
            return
        }
        let prospect = getValue(adf.prospect)
        if (!prospect) {
            console.log("no prospect in adf")
            return
        }
        let vehicle = getValue(prospect.vehicle)
        let customer = getValue(prospect.customer)
        let provider = getValue(prospect.provider)
        if (!vehicle) {
            console.log("no vehicle in prospect")
        }
        res.send(mojo_request)
    })
})



app.listen(port, function () {
    console.log(`Example app listening on port ${port}!`);
});
