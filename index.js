
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// app.use(cors());
app.use(cors({origin: 'https://all-in-one-95e03.web.app/'}))
app.use(express.json())

const uri = "mongodb+srv://dbUser1:test1234@cluster0.7rfww.mongodb.net/?retryWrites=true&w=majority";

// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.7rfww.mongodb.net/?retryWrites=true&w=majority`;

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
        const paymentCollection = client.db('all-in-one').collection('payments');
        const reviewCollection = client.db('all-in-one').collection('review');
        const profileCollection = client.db('all-in-one').collection('profile');

        // const toolCollection = client.db('all-in-one').collection('tools');

        const verifyAdmin = async(req, res, next) => {
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({email: requester})
            if(requesterAccount.role === 'admin'){
                next();
            }
            else{
                res.status(403).send({message: 'forbidden'});
            }
        }
        // payment

        app.post('/create-payment-intent', verifyJWT, async(req, res) =>{
            const part = req.body;
            const price = part.price;
            const amount = price*100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount : amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({clientSecret: paymentIntent.client_secret})
        });

        app.get('/part', async(req, res) => {
            const query = {};
            const cursor = partCollection.find(query);
            const parts = await cursor.toArray();
            res.send(parts);
        });

        app.get('/user',verifyJWT, async(req, res) => {
            const users = await userCollection.find().toArray();
            res.send(users);
        });

        app.get('/admin/:email', async(req, res) =>{
            const email = req.params.email;
            const user = await userCollection.findOne({email: email});
            const isAdmin = user.role === 'admin';
            res.send({admin: isAdmin})
        })

        app.put('/user/admin/:email', verifyJWT, verifyAdmin, async(req, res) => {
            const email = req.params.email;
            
                const filter = {email: email};
            const updateDoc = {
                $set: {role: 'admin'},
            };
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result);
            
        })
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
        });

        // payment

        app.get('/booking/:id', verifyJWT, async(req, res) => {
            const id = req.params.id;
            const query = {_id: ObjectId(id)};
            const booking = await bookingCollection.findOne(query);
            res.send(booking);
        })

        app.post('/booking', async(req, res) => {
            const booking = req.body;
            const result = bookingCollection.insertOne(booking);
            res.send(result);
        })

        app.patch('/booking/:id', verifyJWT, async(req, res)=>{
            const id= req.params.id;
            const payment = req.body;
            const filter = {_id: ObjectId(id)};
            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId,
                }
            }

            const result = await paymentCollection.insertOne(payment);
            const updatedBooking = await bookingCollection.updateOne(filter, updatedDoc);
            res.send(updatedDoc);

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

        // tool
        app.post('/part',verifyJWT, verifyAdmin, async(req, res) => {
            const tool = req.body;
            const result = await partCollection.insertOne(tool);
            res.send(result);
        });

        // add review
        app.post('/review',verifyJWT, async(req, res) => {
            const review = req.body;
            const result = await reviewCollection.insertOne(review);
            res.send(result);
        })

        app.get('/review', async (req, res) => {
            // const id = req.params.id;
            const query = { };
            const cursor = reviewCollection.find(query)
            const review = await cursor.toArray();
            res.send(review);
        });

        // profile
        app.post('/profile', async (req, res) => {
            const profile = req.body;
            const result = await profileCollection.insertOne(profile);
            res.send(result);
          })
      
      
          
          app.get('/profile/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const result = await profileCollection.findOne(filter);
            res.send(result);
          })

        // delete
        app.delete('/part/:id',verifyJWT, verifyAdmin, async(req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await partCollection.deleteOne(filter);
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