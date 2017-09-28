'use strict';

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const uuidv4 = require('uuid/v4');
admin.initializeApp(functions.config().firebase);

const express = require('express');
const app = express();

// Validate the user is logged in taking the Firebase JWT, and adding uid and email to the req.user
const validateFirebaseIdToken = (req, res, next) => {
    console.log('Check if request is authorized with Firebase ID token');

    if (req.originalUrl == '/healthz') {
        return res.send({status: true});
    }

    if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) {
        return res.status(403).send('Unauthorized');
    }

    // Read the ID Token from the Authorization header.
    let idToken = req.headers.authorization.split('Bearer ')[1];

    admin.auth().verifyIdToken(idToken).then(decodedIdToken => {
        console.log('ID Token correctly decoded', decodedIdToken);
        req.user = decodedIdToken;
        next();
    }).catch(error => {
        console.error('Error while verifying Firebase ID token:', error);
        res.status(403).send('Unauthorized');
    });
};

app.use(validateFirebaseIdToken);

app.post('/request', (req, res) => {
    var requestId = uuidv4();
    var data = {
        sender_id: req.user.uid,
        receiver_id: req.body.receiverId
    };
    admin.database().ref(`requests/${requestId}`).set(data, function (error) {
        if (error)
            res.send({error: error})
        else
            res.send({success: true});
    });
});

exports.friend = functions.https.onRequest(app);
