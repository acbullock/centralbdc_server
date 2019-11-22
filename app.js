
const MongoClient = require('mongodb').MongoClient;
const uri = "mongodb+srv://lexliveslife:F%40ceb00k%21@centralbdc-im3cl.mongodb.net/test?retryWrites=true&w=majority";
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
client.connect()
const bodyParser = require('body-parser')



// in sublime
var express = require("express");
var port = process.env.PORT || 3000;
var cors = require('cors');
var app = express();
// app.use(express.json()) 
app.use(cors())
app.use(bodyParser.json({ limit: '5mb' }));
// app.use(express.bodyParser.urlencoded({limit: '50mb', extended: true}));
const ObjectID = require('mongodb').ObjectID;


app.post('/findOne', async function (req, res) {
    let query = req.body.query
    if(query._id !=undefined){
        query._id = new ObjectID(query._id)
    }
    let collection = await client.db("CentralBDC").collection(req.body.collection);
    collection = await collection.findOne(query).catch((err)=>console.log(err))
    res.send(collection);
});

app.post('/findOneAndUpdate', async function(req, res){
    let query = req.body.query
    if(query._id != undefined){
        query._id = new ObjectID(query._id)
        
    }
    let update = req.body.update
    if(update._id != undefined){
        update._id = new ObjectID(update._id)
       
    }
    let collection = await client.db("CentralBDC").collection(req.body.collection);
    let item = await collection.findOne(query).catch((err)=>{console.log(err)})
    item = Object.assign(item, update)
    collection = await collection.findOneAndUpdate(query, {$set: item}).catch((err)=>{console.log(err)})
    res.send(collection)
})
app.post('/findOneAndDelete', async function(req, res){
    let query = req.body.query
    if(query._id != undefined){
        query._id = new ObjectID(query._id)
    }
    let collection = await client.db("CentralBDC").collection(req.body.collection);
    collection = await collection.findOneAndDelete(query).catch((err)=>{console.log(err)})
    res.send(collection)
})
app.post('/find', async function (req, res){
    let collection = await client.db("CentralBDC").collection(req.body.collection);
    collection = await collection.find({}).toArray()
    res.send(collection)
})

app.post('/insertOne', async function (req, res){
    
    let collection = await client.db("CentralBDC").collection(req.body.collection);
    collection = await collection.insertOne(req.body.item)
    res.send(collection)
})
app.listen(port, function () {
    console.log(`Example app listening on port !`);
});