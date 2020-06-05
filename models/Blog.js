var mongoose = require("mongoose");
var Schema = mongoose.Schema;
var blogSchema = new mongoose.Schema({
	name: String,
	image: String,
	title: String,
	description: String,
	likes: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }
    ],
	author: {
		id: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User"
		},
		username: String
	},
	comments: [{
		type: mongoose.Schema.Types.ObjectId,
		ref: "Comment"
	}],
	created: {
		type: Date,
		default: Date.now
	},
	endpoint: String,
	keys: Schema.Types.Mixed
});

module.exports = mongoose.model("Blog", blogSchema);