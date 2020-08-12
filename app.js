
const MongoClient = require('mongodb').MongoClient;

const {
    Stitch,
    StitchCredential,
    UserPasswordCredential,
    UserPasswordAuthProviderClient,
    RemoteMongoClient
} = require("mongodb-stitch-server-sdk");
//get env vars from heroku for local stuff..
const uri = process.env.MONGODB_URI
const user_id = process.env.USER_ID
const template_id = process.env.TEMPLATE_ID
const service_id = process.env.SERVICE_ID
const key = process.env.JWT_KEY
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
client.connect()
const bodyParser = require('body-parser')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const axios = require("axios")
var builder = require('xmlbuilder');
const ObjectID = require('mongodb').ObjectID;
var parseStringPromise = require('xml2js').parseStringPromise;
// in sublime
var express = require("express");
var port = process.env.PORT || 3001;
const stitch_client = Stitch.initializeDefaultAppClient('centralbdc-bwpmi');
let mongodb = stitch_client.getServiceClient(
    RemoteMongoClient.factory,
    "mongodb-atlas"
);
var cors = require('cors');
var app = express();
const adfToMojo = async (req) => {
    let { _id, rules } = req.body
    let { adf, dealership_id } = rules
    if (!_id || !adf) {
        return {}
    }
    let result = {}
    try {
        result = await parseStringPromise(adf, function (err, result) { })

    } catch (error) {
        console.log(error)
        return error

    }
    let mojo_request = {
        user_profile_id: _id,
        dealership_id
    }
    adf = result.adf
    if (!adf) {
        console.log("no adf in xml")
        return {}
    }
    let prospect = getValue(adf.prospect)
    if (!prospect) {
        console.log("no prospect in adf")
        return {}
    }
    let vehicle = getValue(prospect.vehicle)
    let customer = getValue(prospect.customer)
    let provider = getValue(prospect.provider)
    if (!vehicle) {
        console.log("no vehicle in prospect")
    }
    //see if trade in estimate..
    if (vehicle.$ ? vehicle.$.interest === "trade-in" : false) {
        console.log("TRADE")
        let trade_in_vehicle = {}
        let year = getValue(vehicle.year)
        year !== "" ? trade_in_vehicle.year = year : trade_in_vehicle = trade_in_vehicle
        let make = getValue(vehicle.make)
        make !== "" ? trade_in_vehicle.make = make : trade_in_vehicle = trade_in_vehicle
        let model = getValue(vehicle.model)
        model !== "" ? trade_in_vehicle.model = model : trade_in_vehicle = trade_in_vehicle
        let trim = getValue(vehicle.trim)
        trim !== "" ? trade_in_vehicle.trim = trim : trade_in_vehicle = trade_in_vehicle
        let vin = getValue(vehicle.vin)
        trim !== "" ? trade_in_vehicle.trim = trim : trade_in_vehicle = trade_in_vehicle
        let options = getOptions(vehicle.option)

        let colorcombination = getValue(vehicle.colorcombination)
        let interior_color = getValue(colorcombination.interiorcolor)
        interior_color !== "" ? trade_in_vehicle.interior_color = interior_color : trade_in_vehicle = trade_in_vehicle
        let exterior_color = getValue(colorcombination.exteriorcolor)
        exterior_color !== "" ? trade_in_vehicle.exterior_color = exterior_color : trade_in_vehicle = trade_in_vehicle
        // let trade_in_vehicle = {
        //     vin,
        //     model_year: year,
        //     make,
        //     model,
        //     trim,
        //     options,
        //     exterior_color,
        //     interior_color,
        // }
        mojo_request.trade_in_vehicle = trade_in_vehicle
        console.log("!", trade_in_vehicle)
    }
    else {

        let v = {}
        //     let { year, make, model, trim, colorcombination } = vehicle
        let year = getValue(vehicle.year)
        year !== "" ? v.model_year = year : v = v
        let make = getValue(vehicle.make)
        make !== "" ? v.make = make : v = v
        let model = getValue(vehicle.model)
        model !== "" ? v.model = model : v = v
        let trim = getValue(vehicle.trim)
        trim !== "" ? v.trim = trim : v = v
        let vin = getValue(vehicle.vin)
        vin !== "" ? v.vin = vin : v = v
        let stock_number = getValue(vehicle.stock)
        stock_number !== "" ? v.stock_number = stock_number : v = v
        let colorcombination = getValue(vehicle.colorcombination)
        let interior_color = getValue(colorcombination.interiorcolor)
        interior_color !== "" ? v.interior_color = interior_color : v = v
        let exterior_color = getValue(colorcombination.exteriorcolor)
        exterior_color !== "" ? v.exterior_color = exterior_color : v = v
        let options = getOptions(vehicle.option)

        let finance = getValue(vehicle.finance)
        finance = finance.amount || []
        let price = getValue(vehicle.price)
        let index = finance.findIndex((a) => {
            return a.$.type === "monthly"
        })
        let monthly = ""
        if (index !== -1) {
            monthly = finance[index]._
        }
        index = finance.findIndex((a) => {
            return a.$.type === "downpayment"
        })
        let loan = ""
        if (index !== -1) {
            loan = price - finance[index]._
        }
        // let v = {
        //     stock_number,
        //     vin,
        //     model_year: year,
        //     make,
        //     model,
        //     trim,
        //     options,
        //     exterior_color: exterior_color,
        //     interior_color: interior_color,
        // }
        Object.keys(v).length > 0 ? mojo_request.vehicle = v : mojo_request = mojo_request
        mojo_request.financing = {
            preferred_loan_amount: loan,
            preferred_payment_amount: monthly
        }
        mojo_request.financing.preferred_loan_amount === "" ? delete mojo_request.financing.preferred_loan_amount : mojo_request = mojo_request
        mojo_request.financing.preferred_payment_amount === "" ? delete mojo_request.financing.preferred_payment_amount : mojo_request = mojo_request
        Object.keys(mojo_request.financing).length === 0 ? delete mojo_request.financing : mojo_request = mojo_request

    }

    if (!customer) {
        console.log("no customer in prospect")
    }
    else {
        let contact = getValue(customer.contact)
        let comments = getValue(customer.comments)
        if (!contact) {
            console.log("no contact in prospect.customer")
        }
        else {
            let email = getValue(contact.email)
            let phone = getValue(contact.phone)
            let address = getValue(contact.address)
            let name = getName(contact.name)
            let postal = getValue(address.postalcode)
            typeof email === "string" && email.length > 0 ? mojo_request.email = email : mojo_request = mojo_request
            typeof phone === "string" && phone.length > 0 ? mojo_request.phone_number = phone : mojo_request = mojo_request
            mojo_request.first_name = name.first
            mojo_request.last_name = name.last
            mojo_request.postal_code = postal
            mojo_request.adf_prospect_comments = comments
        }
    }
    if (!provider) {
        console.log("no provider in prospect")

    }
    else {
        let name = getValue(provider.name)
        mojo_request.origin = {
            vendor_id: name,
            vendor_name: name
        }
    }
    return mojo_request
}
const askMojo = async (req) => {
    let { body } = req
    let url = "https://api.mojoai.io/v1/ask-mojo"
    let mojo = {}
    try {
        mojo = await axios.post(url, body, {
            headers: {
                Authorization: 'Basic Y2M3OWJhNjktNTFhZi00ZTY4LWI4MTYtNWY4YmM3ZDI0MDlkOjYzYTk3MTNmLTRlYjAtNDgyMC1iODY4LWNkZjNlMTVhYWMyZA=='
            }
        })
        return mojo.data
    } catch (error) {
        return error
    }
}
const sendToCrm = async (user_profile_id) => {
    let collection = await client.db("CentralBDC").collection("mojo_leads");
    let mojo_lead = await collection.findOne({ user_profile_id });
    collection = await client.db("CentralBDC").collection("leads");
    let adf_lead = await collection.findOne({ _id: ObjectID(user_profile_id) })
    if (!adf_lead) {
        console.log("no adf lead")
        return ""
    }
    if (!adf_lead.rules) {
        return ""
    }
    if (!mojo_lead.dealership_id) {
        return ""
    }
    let { vehicle, dealership_id } = mojo_lead
    collection = await client.db("CentralBDC").collection("mojo_dealership_profiles");
    dealership_id = dealership_id.substring(dealership_id.length - 24, dealership_id.length)
    const dlr_name = await collection.findOne({ _id: ObjectID(dealership_id) })
    let { dealershipName, crmEmail } = dlr_name;
    let updated_adf = {
        adf: {
            prospect: {
                '@status': 'new',
                id: {
                    '@source': "CentralBDC",
                    '#text': user_profile_id
                },
                requestdate: new Date().toISOString(),
                vehicle,
                customer: {
                    contact: {
                        name: {
                            '#text': mojo_lead.first_name || ""
                        },
                        email: {
                            '#text': mojo_lead.email || ""
                        },
                        phone: {
                            '#text': mojo_lead.phone_number || ""
                        },
                        // address: prospect_js.customer[0].contact[0].address[0]
                    },
                    comments: {
                        '#text': `Central Ai Score: ${mojo_lead.mojo_score}; Transcript:  ${mojo_lead.transcript ? mojo_lead.transcript.substring(16) : "Not available"} - RECOMMENDED ACTION: ${mojo_lead.recommended_action}`
                    }
                },
                vendor: {
                    vendorname: dealershipName || ""
                },
                provider: {
                    name: "CentralBDC AiChat",
                    service: {
                        '#text': "Engaged Online Shopper"
                    }
                }
            }
        },

    }
    var xmls = builder.create(updated_adf).end({ pretty: true });

    try {
        let email = await axios.post("https://api.emailjs.com/api/v1.0/email/send", {
            service_id,
            template_id,
            user_id,
            "template_params": {
                "to_email": crmEmail || "abullock@centralbdc.com",
                "adf": xmls
            }
        })
        email = email.data;
        console.log(email)
    } catch (error) {
        console.log(error)
    }
    return;
    // console.log(JSON.stringify(updated_adf, null, 2))




}
const getValue = (obj) => {

    if (!obj || !obj[0]) return ""
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
app.post('/getExtensionCallLog', async function (req, res) {
    let {  extension } = req.body;
    let TOKENS = [
        "5e583450576f3ada786de3c2",
        "5e5835a4576f3ada786de3c3",
        "5e617c79ffa244127dd79adc",
        "5ef39198c1c0762bb2871ddd",
        "5ef392bec1c0762bb2871dde",
        "5ef3938bc1c0762bb2871ddf"
    ]
    let page = 1;
    let stop = false
    let recs = []
    while (stop !== true) {
        try {
            let token = await client.db("CentralBDC").collection("utils");
            token = await token.findOne({ _id: new ObjectID(TOKENS[Math.floor(Math.random() * TOKENS.length)]) })
            token = token.voice_token
            console.log(new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
            let curr = await axios.get(`https://platform.ringcentral.com/restapi/v1.0/account/~/extension/${extension}/call-log?access_token=${token}&page=${page}&perPage=1000&dateFrom=${new Date(new Date().setHours(4, 0, 0, 0)).toISOString()}&dateTo=${new Date().toISOString()}`)
            curr = curr.data;
            recs = recs.concat(curr.records)
            if (curr.records.length !== 1000) {
                stop = true;
            }
            else {
                page++;
            }
        } catch (error) {
            stop = true;
            res.status(500).send(error)
        }
    }

    let outbound = recs.filter(r => { return r.direction === "Outbound" })
    let inbound = recs.filter(r => { return r.direction === "Inbound" && r.result === "Accepted" })
    console.log("\tinbound", inbound.length)
    console.log("\toutbound", outbound.length)
    let lastTime = null
    for (let i in recs) {
        if (recs[i].direction === "Inbound" && recs[i].result === "Missed") {
            continue;
        }
        else {
            lastTime = new Date(new Date(recs[i].startTime).getTime() + (recs[i].duration * 1000));
            break;
        }
    }
    let collection = await client.db("CentralBDC").collection("agents");
    collection = collection.findOneAndUpdate({ extension }, { "$set": { inboundToday: inbound.length, outboundToday: outbound.length, callCountLastUpdated: new Date(), lastCall: lastTime } }, { upsert: true }).catch((err) => console.log(err))


    res.send(recs)
})
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
    collection = await client.db("CentralBDC").collection("leads");
    let newItem = await collection.findOne(body)
    let adf = await adfToMojo({ body: newItem })
    let bdc_col = await client.db("CentralBDC").collection("bdc_leads")
    await bdc_col.insertOne({ ...adf, processed_time: new Date().toISOString() })
    await askMojo({ body: adf })
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
    let collection = await client.db("CentralBDC").collection("leads");
    let dealership_id = await collection.findOne({ _id: new ObjectID(user_profile_id) })
    if (!dealership_id) dealership_id = ""
    dealership_id = dealership_id.rules.dealership_id
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
    // let dealership_id = body.dealership_id || ""
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
        email,
        phone_number,
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
        is_test,
        timestamp: new Date().toISOString()
    }
    try {
        let collection = await client.db("CentralBDC").collection("mojo_leads");
        let x = await collection.findOneAndUpdate({ user_profile_id }, { $set: record }, { upsert: true })
        console.log(x, "!")

    } catch (error) {
        res.status(400).send(error)
        return;
    }
    //send email..
    // if (mojo_score !== -1)
    await sendToCrm(user_profile_id)

    res.send(record)

})
app.post("/adfToMojo", async (req, res) => {
    let { _id, rules } = req.body
    let { adf } = rules
    if (!_id || !adf) {
        res.send({})
    }
    let x = await adfToMojo(req)
    res.send(x)
})
app.post("/askMojo", async (req, res) => {
    let { body } = req
    let url = "https://api.mojoai.io/v1/ask-mojo"
    let mojo = {}
    try {
        mojo = await axios.post(url, body, {
            headers: {
                Authorization: 'Basic Y2M3OWJhNjktNTFhZi00ZTY4LWI4MTYtNWY4YmM3ZDI0MDlkOjYzYTk3MTNmLTRlYjAtNDgyMC1iODY4LWNkZjNlMTVhYWMyZA=='
            }
        })
        res.send(mojo.data)
    } catch (error) {
        res.send(error)
    }

})
app.post("/crm", async (req, res) => {
    let { body } = req
    let x = await sendToCrm(body.id)
    res.send(x)
})
app.post("/register", async (req, res) => {
    let { body } = req;
    let { email, password } = body
    const emailPasswordClient = Stitch.defaultAppClient.auth
        .getProviderClient(UserPasswordAuthProviderClient.factory);
    try {
        let result = await emailPasswordClient.registerWithEmail(email, password)
        res.send(result)
    } catch (error) {
        res.send(error)
    }
})
app.post("/getActiveUser", async (req, res) => {
    try {
        let auth = await stitch_client.auth.activeUserAuthInfo
        res.send(auth)
    } catch (error) {
        res.send({ error })
    }
})
app.post("/login", async (req, res) => {
    let { body } = req;
    let { email, password } = body
    console.log(email, password)
    try {
        const credential = new UserPasswordCredential(email, password);
        let auth = await stitch_client.auth.loginWithCredential(credential);
        let { userId } = auth.auth.activeUserAuthInfo
        let collection = await client.db("CentralBDC").collection("agents");
        // // let agent = await db.collection("agents").findOne({email});
        let agent = await collection.findOne({ email })
        if (agent === "")
            res.send("")
        if (agent.userId === undefined) {
            await collection.findOneAndUpdate({ email }, { "$set": { userId } }, { upsert: true })
        }
        res.send(auth.auth.activeUserAuthInfo);
    } catch (error) {
        res.send(error)
    }
})
app.post("/dealer_login", async (req, res) => {
    let { body } = req;
    let { email, password } = body
    console.log(email, password)
    try {
        const credential = new UserPasswordCredential(email, password);
        let auth = await stitch_client.auth.loginWithCredential(credential);
        let { userId } = auth.auth.activeUserAuthInfo
        let collection = await client.db("CentralBDC").collection("dealership_users");
        // // let agent = await db.collection("agents").findOne({email});
        let agent = await collection.findOne({ email })
        if (agent === "")
            res.send("")
        if (agent.userId === undefined) {
            await collection.findOneAndUpdate({ email }, { "$set": { userId } }, { upsert: true })
        }
        res.send(auth.auth.activeUserAuthInfo);
    } catch (error) {
        res.send(error)
    }
})
app.post("/logout", async (req, res) => {
    let auth = await stitch_client.auth.activeUserAuthInfo;
    let { userId } = auth

    try {

        let auth2 = await stitch_client.auth.logoutUserWithId(userId)
        res.send(auth2)
    } catch (error) {
        res.send({ error })
    }
})
app.listen(port, function () {
    console.log(`Example app listening on port ${port}!`);
});
