const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.7rfww.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next){
    const authHeader = req.headers.authorization;
    if(!authHeader){
        return res.status(401).send({message: 'UnAuthorized access'});
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function(err, decoded){
        if(err){
            return res.status(403).send({message: 'Forbidden access'})
        }
        req.decoded = decoded;
        next();
    })
}

async function run(){
    try{
        await client.connect();
        const partCollection = client.db('all-in-one').collection('parts');
        const bookingCollection = client.db('all-in-one').collection('bookings');

        const userCollection = client.db('all-in-one').collection('users');

        app.get('/part', async(req, res) => {
            const query = {};
            const cursor = partCollection.find(query);
            const parts = await cursor.toArray();
            res.send(parts);
        });

    
        // user
        app.put('/user/:email', async(req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = {email: email};
            const options = { upsert: true};
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);

            const token = jwt.sign({email: email}, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '1h'})
            res.send({result, token});
        })

        app.get('/part/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const part = await partCollection.findOne(query);
            res.send(part);
        });

        // booking
        app.get('/booking', verifyJWT, async (req, res) =>{
            const buyer = req.query.buyer;
            
            const decodedEmail = req.decoded.email;
            if(buyer === decodedEmail){
                const query = {buyer: buyer};
            const bookings = await bookingCollection.find(query).toArray();
            return res.send(bookings);
            }
            else{
                return res.status(403).send({message: 'forbidden access'})
            }
        })

        app.post('/booking', async(req, res) => {
            const booking = req.body;
            const result = bookingCollection.insertOne(booking);
            res.send(result);
        })

        app.put("/part/:id", async(req, res) => {
            const id = req.params.id;
            // console.log(id)
            const purchase = req.body;
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true};
            const updateDocument = {
                $set: purchase
            };
            const result = await partCollection.updateOne(
                filter,
                updateDocument,
                options
            );
            console.log("updating", id);
            res.send(result);
        });
    }
    finally{

    }
}

run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hello From All In One')
})


app.listen(port, () => {
  console.log(`Car Parts listening on port ${port}`)
})