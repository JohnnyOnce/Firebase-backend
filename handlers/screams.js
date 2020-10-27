const { db } = require('../util/admin');

exports.getAllScreams = (req, res) => {
    db.collection('screams')
    .orderBy('createdAt', 'desc')
    .get()
    .then(data => {
        let screams = [];
        data.forEach(doc => {
            screams.push({
                screamId: doc.id,
                body: doc.data().body,
                userHandle: doc.data().userHandle,
                createdAt: doc.data().createdAt,
                commentCount: doc.data().commentCount,
                likeCount: doc.data().likeCount,
                userImage: doc.data().userImage
            });
        });
        return res.json(screams); 
    })
    .catch(err => { 
        console.error(err);
        return res.status(500).json(err);
    })
};

exports.postOneScream = (req, res) => {
    if (req.body.body.trim() === '') {
        return res.status(400).json({body: "Body must not be empty"});
    };

    const newScream = {
        body: req.body.body,
        userHandle: req.user.handle,
        createdAt: new Date().toISOString(),
        userImage: req.user.imageUrl,
        commentCount: 0,
        likeCount: 0
    };

    db.collection('screams').add(newScream)
    .then(doc => {
        const resScream = newScream;
        resScream.userId = req.user.uid;
        res.json(resScream);
    })   
    .catch(err => {
        res.status(500).json({message: "something went wrong"});
        console.error(err);
    });
};

exports.getScream = (req, res) => {
    let screamData = {};

    db.doc(`/screams/${req.params.screamId}`).get()
    .then(doc => {
        if (!doc.exists) {
            return res.status(404).json({ error: "Scream is not found"});
        }
        screamData = doc.data();
        screamData.screamId = doc.id;
        return db.collection('comments').where('screamId', '==', req.params.screamId).orderBy('createdAt', 'desc').get();
    })
    .then(data => {
        screamData.comments = [];
        data.forEach(doc => {
            screamData.comments.push(doc.data());
        });
        return res.json(screamData);
    })
    .catch(err => {
        console.error(err);
        return res.status(500).json({ error: err.code});
    })
};

exports.commentOnScream = (req, res) => {
    if (req.body.body.trim() === '') {
        return res.status(400).json({ comment: 'Comment must not be empty' });
    };

    const newComment = {
        body: req.body.body,
        createdAt: new Date().toISOString(),
        screamId: req.params.screamId,
        userHandle: req.user.handle,
        userImage: req.user.imageUrl
    };

    db.doc(`/screams/${req.params.screamId}`).get()
    .then(doc => {
        if (!doc.exists) return res.status(404).json({ error: 'Scream not found'});
        return doc.ref.update({ commentCount: doc.data().commentCount + 1 });
    })
    .then(() => db.collection('comments').add(newComment))
    .then(() => res.json(newComment))
    .catch(err => {
        console.error(err);
        return res.status(500).json({ error: 'Something went wrong'});
    })
};

exports.likeScream = (req, res) => {
    const likeDocument = db.collection('likes').where('userHandle', '==', req.user.handle)
    .where('screamId', '==', req.params.screamId).limit(1);

    const screamDocument = db.doc(`/screams/${req.params.screamId}`);

    let screamData = {};

    screamDocument.get()
    .then(doc => {
        if (doc.exists) {
            screamData = doc.data();
            screamData.screamId = doc.id;
            return likeDocument.get();
        }
        else {
            return res.status(404).json({message: 'Scream not found'});
        }
    })
    .then(data => {
        if (data.empty) {
            return db.collection('likes').add({
                screamId: req.params.screamId,
                userHandle: req.user.handle
            })
            .then(() => {
                screamData.likeCount++;
                return screamDocument.update({ likeCount: screamData.likeCount });
            })
            .then(() => {
                return res.json(screamData);
            })
        }
        else {
            return res.status(400).json({ message: 'Scream already liked'});
        }
    })
    .catch((err) => {
        console.error(err);
        return res.status(500).json({ error: err.code });
    });
};

exports.unlikeScream = (req, res) => {
    const likeDocument = db.collection('likes').where('userHandle', '==', req.user.handle).where('screamId', '==', req.params.screamId).limit(1);

    const screamDocument = db.doc(`/screams/${req.params.screamId}`);

    let screamData = {};

    screamDocument.get()
    .then(doc => {
        if (doc.exists) {
            screamData = doc.data();
            screamData.screamId = doc.id;
            return likeDocument.get();
        }
        else {
            return res.status(404).json({message: 'Scream not found'});
        }
    })
    .then(data => {
        console.log(data);
        if (data.empty) {
            return res.status(400).json({ message: 'Scream not liked'});
        }
        else {
            return db.doc(`/likes/${data.docs[0].id}`).delete()
            .then(() => {
                screamData.likeCount--;
                return screamDocument.update({ likeCount: screamData.likeCount });
            })
            .then(() => {
                return res.json(screamData);
            })
        }
    })
    .catch((err) => {
        console.error(err);
        return res.status(500).json({ error: err.code });
    });
}

exports.deleteScream = (req, res) => {
    const document = db.doc(`/screams/${req.params.screamId}`);
    document.get()
    .then(doc => {
        if (!doc.exists) {
            return res.status(404).json({error: 'Not found'});
        };
        if (doc.data().userHandle !== req.user.handle) {
            return res.status(403).json({message: 'Unauthorized'});
        }
        else {
            return document.delete();
        }
    })
    .then(() => res.json({message: 'Deleted successfully'}))
    .catch(err => {
        console.error(err);
        return res.status(500).json({ error: err.code});
    })
}