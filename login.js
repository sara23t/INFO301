var mysql = require("mysql");
var express = require("express");
const session = require('express-session');
const redis = require('redis');
var cookieParser = require("cookie-parser");
var path = require("path");
var ejs = require("ejs");
const fs = require("fs");
var readline = require("readline");
const e = require("express");
var bcrypt = require('bcrypt');
const { table } = require("console");
const fileUpload = require('express-fileupload');
const { request } = require("http");
require("dotenv").config();
var connection = mysql.createPool({
	host: process.env.DB_HOST,
	user: process.env.DB_USER,
	password: process.env.DB_PASSWORD,
	database: process.env.DB_DATABASE,
	port: process.env.DB_PORT,
	multipleStatements: true
});
var rl = readline.createInterface({
	input: fs.createReadStream(__dirname + "/schema/schema.sql"),
	terminal: false,
});
rl.on("line", function (chunk) {
	connection.query(chunk.toString("ascii"), function (err, sets, fields) {
		if (err) console.log(err);
	});
});
rl.on("close", function () { });
let RedisStore = require('connect-redis')(session);
let redisClient = redis.createClient();
var app = express();
app.use(
	fileUpload({
		limits: {
			fileSize: 10000000,
		},
		abortOnLimit: true,
	})
);
app.use(session({
	secret: 'veryimportantsecret',
	resave: false,
	saveUninitialized: true
}))
app.use(
	session({
		secret: ['veryimportantsecret', 'notsoimportantsecret', 'highlyprobablysecret'],
		name: "secretname",
		cookie: {
			httpOnly: true,
			secure: true,
			sameSite: true,
			maxAge: 600000 // Time is in miliseconds
		},
		store: new RedisStore({ client: redisClient, ttl: 86400 }),
		resave: false,
		saveUninitialized: true
	})
)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(__dirname + "/views"));
app.set("view engine", "ejs");
const viewPath = path.join(__dirname, "/views");
app.get("/", function (request, response) {
	response.render("index");
});
/** Error */
app.get("/error", function (request, response) {
	response.render("error");
});
/** Log in routes */
app.get("/mentorlogin", function (request, response) {
	response.render("mentor-login", { userData: null });
});
app.get("/menteelogin", function (request, response) {
	response.render("mentee-login", { userData: null });
});
app.get("/adminlogin", function (request, response) {
	response.render("admin-login");
});
/** Sign up routes */
app.get("/mentor-signup", function (request, response) {
	response.render("mentor-signup", { userData: null });
});
app.get("/mentee-signup", function (request, response) {
	response.render("mentee-signup", { userData: null });
});
/**Routes for resources */
app.get("/mentee-resources", function (request, response) {
	if (request.session.admin || request.session.accounttype == "mentee"){
	connection.query("SELECT * FROM Resources", function (err, data) {
		response.render("mentee-resources", { title: "User List", userData: data });
	});
	} else {
		response.redirect("error");
	}
});
app.get("/mentor-resources", function (request, response) {
	if (request.session.admin || request.session.accounttype == "mentor"){
	connection.query("SELECT * FROM Resources", function (err, data) {
		response.render("mentor-resources", { title: "User List", userData: data });
	});
	} else {
		response.redirect("error");
	}
});
app.get("/resources-admin", function (request, response) {
	if (request.session.admin){
	connection.query("SELECT * FROM Resources", function (err, data) {
		response.render("resources-admin", { title: "User List", userData: data });
	});
	} else {
		response.redirect("error");
	}
});
/** Routes to Home pages */
app.get("/menteeHome", function (request, response) {
	if (request.session.admin || request.session.accounttype == "mentee"){
	connection.query(
		"SELECT * from Matches WHERE mentee_username = ?;" +
		"SELECT * FROM Meetings WHERE mentee_username = ?;", [request.session.username, request.session.username],
		function (err, data) {
			if (err) console.log(err);
			response.render("menteeHome", { title: "User List", userData: data });
		});
	} else {
		response.redirect("error");
	}
});
app.get("/mentorHome", function (request, response) {
	if (request.session.admin || request.session.accounttype == "mentor"){
	connection.query(
		"SELECT * from Matches WHERE mentor_username = ?;" +
		"SELECT * from Meetings WHERE mentor_username = ?", [request.session.username, request.session.username],
		function (err, data) {
			if (err) console.log(err);
			response.render("mentorHome", { title: "User List", userData: data });
		});
	} else {
		response.redirect("error");
	}
});

/** Admin ability to add, delete and update resources */
app.post("/add-resource", function (request, response) {
	if (request.session.admin){
	connection.query("INSERT INTO Resources VALUES (?,?,?,?)", [null,request.body.ResourceName, request.body.ResourceLink, request.body.MentorView], function (error, data) {
		if (error) console.log(error);
		response.redirect("/resources-admin");
	});
	} else {
		response.redirect("error");
	}
});
app.post("/delete-resources", function (request, response) {
	if (request.session.admin){
	connection.query("DELETE FROM Resources WHERE ResourceName = ?", [request.body.ResourceName], function (error, data) {
		if (error) console.log(error);
		response.redirect("/resources-admin");
	});
	} else {
		response.redirect("error");
	}
});
app.post("/update-resources", function (request, response) {
	if (request.session.admin){
	connection.query("UPDATE Resources SET ResourceLink = ?, ResourceName = ?, MentorView = ? WHERE ResourceName = ?", [request.body.ResourceLink, request.body.ResourceName, request.body.MentorView, request.body.originalName], function (error, data) {
		if (error) console.log(error);
		response.redirect("/resources-admin");
	});
	} else {
		response.redirect("error");
	}
});

/** Mentee apply for a mentor */
app.post("/menteeapply", function (request, response) {
	if (request.session.accounttype == "mentee"){
	var mentor_name = request.body.mentorfirstname+ ' ' + request.body.mentorsurname;
	connection.query("SELECT first_name, surname from Mentee WHERE mentee_username = ?", [request.session.username], function (error, data, fields) {
		var mentee_name = data[0].first_name + ' ' + data[0].surname;
		connection.query("INSERT INTO Matches (mentee_username,mentor_username,mentee_name,mentor_name) VALUES (?,?,?,?);", [request.session.username, request.body.mentorusername, mentee_name, mentor_name], function (error, results) {
			if (error) console.log(error)
			response.redirect("/menteeHome");
		});
	});
	} else {
		response.redirect("error");
	}
});

/** Mentor able to approve or deny the mentee application */
app.post("/mentorapproves", function (request, response) {
	if (request.session.accounttype == "mentor"){
	connection.query("UPDATE Matches set mentor_approval = true WHERE mentee_username = ? AND mentor_username = ?;", [request.body.menteeusername, request.session.username], function (error, results) {
		if (error) console.log(error)
		response.redirect("/mentorHome");
	});
	} else {
		response.redirect("error");
	}
});
app.post("/mentordeclines", function (request, response) {
	if (request.session.accounttype == "mentor"){
	connection.query("UPDATE Matches set mentor_approval = false WHERE mentee_username = ? AND mentor_username = ?;", [request.body.menteeusername, request.session.username], function (error, results) {
		if (error) console.log(error)
		response.redirect("/mentorHome");
	});
	} else {
		response.redirect("error");
	}
});

/** Admin approves or declines the application */
app.post("/adminapproves", function (request, response) {
	if (request.session.admin){
	var mentee = request.body.menteeusername;
	var mentor = request.body.mentorusername
	connection.query(
		"UPDATE Matches set mentor_approval = false WHERE mentee_username = " +
		'"' + mentee + '"; ' +
		"UPDATE Matches set mentor_approval = true, admin_approval = true WHERE mentee_username = " +
		'"' + mentee + '" ' +
		"AND mentor_username = " +
		'"' + mentor + '";', function (error, results) {
			if (error) console.log(error);
			response.redirect("/admin-home");
		});
	} else {
		response.redirect("error");
	}
});
app.post("/admindeclines", function (request, response) {
	if (request.session.admin){
	connection.query("UPDATE Matches set admin_approval = false WHERE mentee_username = ? AND mentor_username = ?;", [request.body.menteeusername, request.body.mentorusername], function (error, results) {
		if (error) console.log(error);
		response.redirect("/admin-home");
	});
	} else {
		response.redirect("error");
	}
});

/** Mentee, mentor, admin able to remove the match */
app.post("/menteeremoves", function (request, response) {
	if (request.session.accounttype == "mentee"){
	connection.query("DELETE FROM Matches WHERE mentee_username = ? AND mentor_username = ?;"+
	"DELETE FROM meetings WHERE mentee_username = ? AND mentor_username = ?;",
	[request.session.username,request.body.mentorusername,request.session.username,request.body.mentorusername],function (error, results) {
		if (error) console.log(error);
		response.redirect("/menteeHome");
	});
	} else {
		response.redirect("error");
	}
});
app.post("/mentorremoves", function (request, response) {
	if (request.session.accounttype == "mentor"){
	connection.query("DELETE FROM Matches WHERE mentee_username = ? AND mentor_username = ?;"+
	"DELETE FROM meetings WHERE mentee_username = ? AND mentor_username = ?;", 
	[request.body.menteeusername,request.session.username,request.body.menteeusername,request.session.username],function (error, results) {
		if (error) console.log(error);
		response.redirect("/mentorHome");
	});
	} else {
		response.redirect("error");
	}
});
app.post("/adminremoves", function (request, response) {
	if (request.session.admin){
	connection.query("DELETE FROM Matches WHERE mentee_username = ? AND mentor_username = ?;" + 
	"DELETE FROM meetings WHERE mentee_username = ? AND mentor_username = ?;",
	[request.body.menteeusername,request.body.mentorusername,request.body.menteeusername,request.body.mentorusername],function (error, results) {
		if (error) console.log(error);
		response.redirect("/admin-home");
	});
	} else {
		response.redirect("error");
	}
});


app.post("/mentoracknowledges", function (request, response) {
	if (request.session.accounttype == "mentor"){
	connection.query("UPDATE Matches set mentor_approval = false, admin_approval = null WHERE mentee_username = ? AND mentor_username = ?;", [request.body.menteeusername, request.session.username], function (error, results) {
		if (error) console.log(error);
		response.redirect("/mentorHome");
	});
	} else {
		response.redirect("error");
	}
});


app.post("/meetingapply", function (request, response) {
	if (request.session.accounttype == "mentee"){
	connection.query("INSERT INTO Meetings (mentee_username,mentee_name,mentor_username,mentor_name,title,description,meetingdate,starttime,endtime) VALUES (?,?,?,?,?,?,?,?,?);",
	[request.session.username, request.body.mentee_name, request.body.mentor_username, request.body.mentor_name, request.body.title, request.body.description, request.body.meetingdate,request.body.starttime, request.body.endtime],function (error, results) {
		if (error) console.log(error);
		response.redirect("/menteeHome");
	});
	} else {
		response.redirect("error");
	}
});
app.post("/mentormeetingdecline", function (request, response) {
	if (request.session.accounttype == "mentor"){
	connection.query("UPDATE Meetings SET approval = 1 WHERE mentee_username = ? AND mentor_username = ?;", [request.body.mentee_username,request.session.username],function (error, results) {
		if (error) console.log(error);
		response.redirect("/mentorHome");
	});
	} else {
		response.redirect("error");
	}
});
app.post("/mentormeetingaccept", function (request, response) {
	if (request.session.accounttype == "mentor"){
	connection.query("UPDATE Meetings SET approval = 2 WHERE mentee_username = ? AND mentor_username = ?;", [request.body.mentee_username,request.session.username],function (error, results) {
		if (error) console.log(error);
		response.redirect("/mentorHome");
	});
	} else {
		response.redirect("error");
	}
});
app.post("/mentormeetingreply", function (request, response) {
	if (request.session.accounttype == "mentor"){
	connection.query("UPDATE Meetings SET approval = 3, description = ?, meetingdate = ?, starttime = ?, endtime = ? WHERE mentee_username = ? AND mentor_username = ?;", [request.body.description,request.body.meetingdate,request.body.starttime,request.body.endtime,request.body.mentee_username,request.session.username],function (error, results) {
		if (error) console.log(error);
		response.redirect("/mentorHome");
	});
	} else {
		response.redirect("error");
	}
});
app.post("/mentormeetingdelete", function (request, response) {
	if (request.session.accounttype == "mentor"){
	connection.query("DELETE FROM Meetings WHERE mentee_username = ? AND mentor_username = ?;", [request.body.mentee_username,request.session.username],function (error, results) {
		if (error) console.log(error);
		response.redirect("/mentorHome");
	});
	} else {
		response.redirect("error");
	}
});
app.post("/mentormeetingcancel", function (request, response) {
	if (request.session.accounttype == "mentor"){
	connection.query("UPDATE Meetings SET approval = 5 WHERE mentee_username = ? AND mentor_username = ?;", [request.body.mentee_username,request.session.username],function (error, results) {
		if (error) console.log(error);
		response.redirect("/mentorHome");
	});
	} else {
		response.redirect("error");
	}
});
app.post("/menteemeetingdecline", function (request, response) {
	if (request.session.accounttype == "mentee"){
	connection.query("UPDATE Meetings SET approval = 4 WHERE mentee_username = ? AND mentor_username = ?;", [request.session.username,request.body.mentor_username],function (error, results) {
		if (error) console.log(error);
		response.redirect("/menteeHome");
	});
	} else {
		response.redirect("error");
	}
});
app.post("/menteemeetingaccept", function (request, response) {
	if (request.session.accounttype == "mentee"){
	connection.query("UPDATE Meetings SET approval = 2 WHERE mentee_username = ? AND mentor_username = ?;", [request.session.username,request.body.mentor_username],function (error, results) {
		if (error) console.log(error);
		response.redirect("/menteeHome");
	});
	} else {
		response.redirect("error");
	}
});
app.post("/menteemeetingreply", function (request, response) {
	if (request.session.accounttype == "mentee"){
	connection.query("UPDATE Meetings SET approval = 0, description = ?, meetingdate = ?, starttime = ?, endtime = ? WHERE mentee_username = ? AND mentor_username = ?;", [request.body.description, request.body.meetingdate, request.body.starttime,request.body.endtime,request.session.username,request.body.mentor_username],function (error, results) {
		if (error) console.log(error);
		response.redirect("/menteeHome");
	});
	} else {
		response.redirect("error");
	}
});
app.post("/menteemeetingdelete", function (request, response) {
	if (request.session.accounttype == "mentee"){
	connection.query("DELETE FROM Meetings WHERE mentee_username = ? AND mentor_username = ?;", [request.session.username,request.body.mentor_username],function (error, results) {
		if (error) console.log(error);
		response.redirect("/menteeHome");
	});
	} else {
		response.redirect("error");
	}
});
app.post("/menteemeetingcancel", function (request, response) {
	if (request.session.accounttype == "mentee"){
	connection.query("UPDATE Meetings SET approval = 6 WHERE mentee_username = ? AND mentor_username = ?;", [request.session.username,request.body.mentor_username],function (error, results) {
		if (error) console.log(error);
		response.redirect("/menteeHome");
	});
	} else {
		response.redirect("error");
	}
});
/** display mentee and mentor contact details from admin page */
app.get("/admin-home", function (req, res, next) {
	if (req.session.admin){
	var sq = "SELECT mentee_username, first_name, surname, email_address, phone_number, imagepath FROM Mentee;" +
		"SELECT mentor_username, first_name, surname, email_address, phone_number, imagepath, hidden FROM Mentor;" +
		"SELECT * FROM Matches;"
	connection.query(sq, function (err, data, fields) {
		// console.log(data);
		res.render("admin-home", { title: "User List", userData: data });
	});
	} else {
		res.redirect("error");
	}
});
/** display mentee and mentor contact details from admin page for print function */
app.get("/admin-dataprint", function (req, res, next) {
	if (req.session.admin){
	var sq = "SELECT mentee_username, first_name, surname, email_address, phone_number, imagepath FROM Mentee;" +
		"SELECT mentor_username, first_name, surname, email_address, phone_number, imagepath, hidden FROM Mentor;" +
		"SELECT * FROM Matches;"
	connection.query(sq, function (err, data, fields) {
		res.render("admin-dataprint", { title: "User List", userData: data });
	});
	} else {
		res.redirect("error");
	}
});
/** display mentee details */
app.get("/menteeProfile", function (req, res, next) {
	if (req.session.accounttype == "mentee" || req.session.admin){
	var sq =
		"SELECT mentee_username, first_name, surname, email_address, phone_number, imagepath FROM mentee WHERE mentee_username = '" +
		req.session.username +
		"';" +
		"SELECT * FROM menteeeducation WHERE mentee_username = '" +
		req.session.username +
		"';" +
		"SELECT * FROM menteeexperience WHERE mentee_username = '" +
		req.session.username +
		"';" +
		"SELECT mentee_username, technical FROM menteeskills WHERE technical IS NOT NULL AND mentee_username = '" +
		req.session.username +
		"';" +
		"SELECT mentee_username, interpersonal FROM menteeskills WHERE interpersonal IS NOT NULL AND mentee_username = '" +
		req.session.username +
		"';" +
		"SELECT * FROM menteeinterest WHERE mentee_username = '" +
		req.session.username +
		"';" +
		"SELECT * FROM extra_mentee WHERE mentee_username = '" +
		req.session.username +
		"'";
	connection.query(sq, function (err, data, fields) {
		res.render("menteeProfile", { title: "User List", userData: data });
	});
	} else {
		res.redirect("error");
	}
});

/** edit phone number and email bio for mentee */
app.post("/menteePhone", function (request, response) {
	if (request.session.accounttype == "mentee" || request.session.admin){
	var phonenumber = request.body.phonenumber;
	var email = request.body.email;
	var bio = request.body.bio;
	var username = request.session.username;
	var selected_industry = request.body.select_industry;
	connection.query(
		" UPDATE mentee SET phone_number = " +
		'"' +
		phonenumber +
		'"' +
		", email_address = " +
		'"' +
		email +
		'"' +
		" WHERE mentee_username = " +
		'"' +
		username +
		'"; ' +
		" UPDATE extra_mentee SET bio = " +
		'"' +
		bio +
		'"' +
		',' +
		"selected_industry = " +
		'"' +
		selected_industry +
		'"' +
		" WHERE mentee_username = " +
		'"' +
		username +
		'";',
		function (error, results) {
			if (error) throw error;
			if (request.session.admin) {
				response.redirect(307, "/menteeProfile");
			} else {
				response.redirect("/menteeProfile");
			}
		}
	);
	} else {
		response.redirect("error");
	}
});
/** edit social media links for mentee */
app.post("/uploadsocialmedia", function (request, response) {
	if (request.session.accounttype == "mentee" || request.session.admin){
	var facebook_link = request.body.facebook;
	var linkedin_link = request.body.linkedin;
	var username = request.session.username;
	connection.query(
		" UPDATE extra_mentee SET facebook_link = " +
		'"' +
		facebook_link +
		'"' +
		',' +
		"linkedin_link = " +
		'"' +
		linkedin_link +
		'"' +
		" WHERE mentee_username = " +
		'"' +
		username +
		'";',
		function (error, results) {
			if (error) throw error;
			if (request.session.admin) {
				response.redirect(307, "/menteeProfile");
			} else {
				response.redirect("/menteeProfile");
			}
		}
	);
	} else {
		response.redirect("error");
	}
});

/** display and edit mentee details for admin */
app.post("/menteeProfile", function (req, res, next) {
	if (req.session.admin){
	if (typeof req.body.username != 'undefined') {
		req.session.username = req.body.username;
	}
	var sq =
		"SELECT mentee_username, first_name, surname, email_address, phone_number, imagepath FROM mentee WHERE mentee_username = '" +
		req.session.username +
		"';" +
		"SELECT * FROM menteeeducation WHERE mentee_username = '" +
		req.session.username +
		"';" +
		"SELECT * FROM menteeexperience WHERE mentee_username = '" +
		req.session.username +
		"';" +
		"SELECT mentee_username, technical FROM menteeskills WHERE technical IS NOT NULL AND mentee_username = '" +
		req.session.username +
		"';" +
		"SELECT mentee_username, interpersonal FROM menteeskills WHERE interpersonal IS NOT NULL AND mentee_username = '" +
		req.session.username +
		"';" +
		"SELECT * FROM menteeinterest WHERE mentee_username = '" +
		req.session.username +
		"';" +
		"SELECT * FROM extra_mentee WHERE mentee_username = '" +
		req.session.username +
		"'";
	connection.query(sq, function (err, data, fields) {
		res.render("menteeProfile-admin", { title: "User List", userData: data });
	});
	} else {
		res.redirect("error");
	}
});
/** display mentor details and edit for admin */
app.post("/mentorProfile", function (req, res, next) {
	if (req.session.admin){
	if (typeof req.body.username != 'undefined') {
		req.session.username = req.body.username;
	} var sq =
		"SELECT mentor_username, first_name, surname, email_address, phone_number, imagepath, hidden FROM mentor WHERE mentor_username = '" +
		req.session.username +
		"';" +
		"SELECT * FROM mentoreducation WHERE mentor_username = '" +
		req.session.username +
		"';" +
		"SELECT * FROM mentorexperience WHERE mentor_username = '" +
		req.session.username +
		"';" +
		"SELECT mentor_username, technical FROM mentorskills WHERE technical IS NOT NULL AND mentor_username = '" +
		req.session.username +
		"';" +
		"SELECT mentor_username, interpersonal FROM mentorskills WHERE interpersonal IS NOT NULL AND mentor_username = '" +
		req.session.username +
		"';" +
		"SELECT * FROM mentorinterest WHERE mentor_username = '" +
		req.session.username +
		"';" +
		"SELECT * FROM mentorpreference WHERE mentor_username = '" +
		req.session.username +
		"';" +
		"SELECT * FROM extra_mentor WHERE mentor_username = '" +
		req.session.username +
		"'";
	connection.query(sq, function (err, data, fields) {
		// console.log(data[7]);
		res.render("mentorProfile-admin", { title: "User List", userData: data });
	});
	} else {
		res.redirect("error");
	}
});

/** Mentee and Mentor Profiles
 * display mentee details */
app.get("/menteeProfile", function (req, res, next) {
	if (req.session.accounttype == "mentee"){
	var sq =
		"SELECT mentee_username, first_name, surname, email_address, phone_number, imagepath FROM mentee WHERE mentee_username = '" +
		req.session.username +
		"';" +
		"SELECT * FROM menteeeducation WHERE mentee_username = '" +
		req.session.username +
		"';" +
		"SELECT * FROM menteeexperience WHERE mentee_username = '" +
		req.session.username +
		"';" +
		"SELECT mentee_username, technical FROM menteeskills WHERE technical IS NOT NULL AND mentee_username = '" +
		req.session.username +
		"';" +
		"SELECT mentee_username, interpersonal FROM menteeskills WHERE interpersonal IS NOT NULL AND mentee_username = '" +
		req.session.username +
		"';" +
		"SELECT * FROM menteeinterest WHERE mentee_username = '" +
		req.session.username +
		"';" +
		"SELECT * FROM extra_mentee WHERE mentee_username = '" +
		req.session.username +
		"'";
	connection.query(sq, function (err, data, fields) {
		// console.log(data[0]);
		// console.log(data[6]);
		res.render("menteeProfile", { title: "User List", userData: data });
	});
	} else {
		res.redirect("error");
	}
});

/** edit phone number and email bio for mentee */
app.post("/menteePhone", function (request, response) {
	if (request.session.accounttype == "mentee" || request.session.admin){
	var phonenumber = request.body.phonenumber;
	var email = request.body.email;
	var bio = request.body.bio;
	var username = request.session.username;
	// var facebook_link = request.body.facebook;
	// var linkedin_link = request.body.linkedin;
	var selected_industry = request.body.select_industry;
	connection.query(
		" UPDATE mentee SET phone_number = " +
		'"' +
		phonenumber +
		'"' +
		", email_address = " +
		'"' +
		email +
		'"' +
		" WHERE mentee_username = " +
		'"' +
		username +
		'"; ' +
		" UPDATE extra_mentee SET bio = " +
		'"' +
		bio +
		'"' +
		',' +
		"selected_industry = " +
		'"' +
		selected_industry +
		'"' +
		" WHERE mentee_username = " +
		'"' +
		username +
		'";',
		function (error, results) {
			if (error) throw error;
			if (request.session.admin) {
				response.redirect(307, "/menteeProfile");
			} else {
				response.redirect("/menteeProfile");
			}
		}
	);
	} else {
		response.redirect("error");
	}
});

/** edit social media links for mentee */
app.post("/uploadsocialmedia", function (request, response) {
	if (request.session.accounttype == "mentee" || request.session.admin){
	var facebook_link = request.body.facebook;
	var linkedin_link = request.body.linkedin;
	var username = request.session.username;
	connection.query(
		" UPDATE extra_mentee SET facebook_link = " +
		'"' +
		facebook_link +
		'"' +
		',' +
		"linkedin_link = " +
		'"' +
		linkedin_link +
		'"' +
		" WHERE mentee_username = " +
		'"' +
		username +
		'";',
		function (error, results) {
			if (error) throw error;
			if (request.session.admin) {
				response.redirect(307, "/menteeProfile");
			} else {
				response.redirect("/menteeProfile");
			}
		}
	);
	} else {
		response.redirect("error");
	}
});
 /** Add mentee education */
app.post("/menteeEducation", function (request, response) {
	if (request.session.accounttype == "mentee" || request.session.admin){
	var username = request.session.username;
	var level = request.body.level;
	var discipline = request.body.discipline;
	var institution = request.body.institution;
	connection.query("INSERT INTO menteeeducation VALUES (?,?,?,?);", [username, level, discipline, institution],
		function (error, results) {
			if (error) throw error;
			if (request.session.admin) {
				response.redirect(307, "/menteeProfile");
			} else {
				response.redirect("/menteeProfile");
			}
		}
	);
	} else {
		response.redirect("error");
	}
});
/** Delete mentee education */
app.post("/menteeDeleteEducation", function (request, response) {
	if (request.session.accounttype == "mentee" || request.session.admin){
	var level = request.body.level1;
	var discipline = request.body.discipline1;
	var institution = request.body.institution1;
	var username = request.session.username;
	connection.query("DELETE FROM menteeeducation WHERE level = ? AND discipline = ? AND institution = ? AND mentee_username = ?", [level, discipline, institution, username],
		function (error, results) {
			if (error) throw error;
			if (request.session.admin) {
				response.redirect(307, "/menteeProfile");
			} else {
				response.redirect("/menteeProfile");
			}
		}
	);
	} else {
		response.redirect("error");
	}
});
/** Add mentee experience */
app.post("/menteeExperience", function (request, response) {
	if (request.session.accounttype == "mentee" || request.session.admin){
	var username = request.session.username;
	var role = request.body.role;
	var organisation = request.body.organisation;
	var industry = request.body.industry;
	connection.query("INSERT INTO menteeExperience VALUES (?,?,?,?);", [username, role, organisation, industry],
		function (error, results) {
			if (error) throw error;
			if (request.session.admin) {
				response.redirect(307, "/menteeProfile");
			} else {
				response.redirect("/menteeProfile");
			}
		});
	} else {
		response.redirect("error");
	}
});
/** Delete mentee experience */
app.post("/menteeDeleteExperience", function (request, response) {
	if (request.session.accounttype == "mentee" || request.session.admin){
	var username = request.session.username;
	var role = request.body.role;
	var organisation = request.body.organisation;
	var industry = request.body.industry;
	connection.query("DELETE FROM menteeExperience WHERE role= ? AND organisation = ? AND industry = ? AND mentee_username = ?", [role, organisation, industry, username],
		function (error, results) {
			if (error) throw error;
			if (request.session.admin) {
				response.redirect(307, "/menteeProfile");
			} else {
				response.redirect("/menteeProfile");
			}
		});
	} else {
		response.redirect("error");
	}
});

/** add mentee skills */
app.post("/menteeSkills", function (request, response) {
	if (request.session.accounttype == "mentee" || request.session.admin){
	var username = request.session.username;
	var type = request.body.skillType;
	var description = request.body.skillDescription;
	connection.query(
		"INSERT INTO menteeSkills(mentee_username, " + type + ")" + "VALUES (" +
		'"' +
		username +
		'"' +
		"," +
		'"' +
		description +
		'"' +
		");",
		function (error, results) {
			if (error) throw error;
			if (request.session.admin) {
				response.redirect(307, "/menteeProfile");
			} else {
				response.redirect("/menteeProfile");
			}
		}
	);
	} else {
		response.redirect("error");
	}
});
/** delete mentee technical skills */
app.post("/menteeDeleteTechnical", function (request, response) {
	if (request.session.accounttype == "mentee" || request.session.admin){
	var technical = request.body.technical;
	var username = request.session.username;
	connection.query("DELETE FROM menteeSkills WHERE technical = ? AND mentee_username = ?", [technical, username],
		function (error, results) {
			if (error) throw error;
			if (request.session.admin) {
				response.redirect(307, "/menteeProfile");
			} else {
				response.redirect("/menteeProfile");
			}
		});
	} else {
		response.redirect("error");
	}
});
/** delete mentee interpersonal skills */
app.post("/menteeDeleteInterpersonal", function (request, response) {
	if (request.session.accounttype == "mentee" || request.session.admin){
	var interpersonal = request.body.interpersonal;
	var username = request.session.username;
	connection.query("DELETE FROM menteeSkills WHERE interpersonal= ? AND mentee_username= ?", [interpersonal, username],
		function (error, results) {
			if (error) throw error;
			if (request.session.admin) {
				response.redirect(307, "/menteeProfile");
			} else {
				response.redirect("/menteeProfile");
			}
		}
	);
	} else {
		response.redirect("error");
	}
});
/** add mentee interest */
app.post("/menteeInterest", function (request, response) {
	if (request.session.accounttype == "mentee" || request.session.admin){
	var username = request.session.username;
	var interest = request.body.interest;
	connection.query("INSERT INTO menteeInterest VALUES (?,?);", [username, interest],
		function (error, results) {
			if (error) throw error;
			if (request.session.admin) {
				response.redirect(307, "/menteeProfile");
			} else {
				response.redirect("/menteeProfile");
			}
		}
	);
	} else {
		response.redirect("error");
	}
});
/** delete mentee interest */
app.post("/menteeDeleteInterest", function (request, response) {	
	if (request.session.accounttype == "mentee" || request.session.admin){
	var interest = request.body.interest;
	var username = request.session.username;
	connection.query(
		"DELETE FROM menteeinterest WHERE interests = ? AND mentee_username = ?", [interest, username],
		function (error, results) {
			if (error) throw error;
			if (request.session.admin) {
				response.redirect(307, "/menteeProfile");
			} else {
				response.redirect("/menteeProfile");
			}
		}
	);
	} else {
		response.redirect("error");
	}
});
/** display mentor details */
app.get("/mentorProfile", function (req, res, next) {
	if (req.session.accounttype == "mentor" || req.session.admin){
	var sq =
		"SELECT mentor_username, first_name, surname, email_address, phone_number, imagepath, hidden FROM mentor WHERE mentor_username = '" +
		req.session.username +
		"';" +
		"SELECT * FROM mentoreducation WHERE mentor_username = '" +
		req.session.username +
		"';" +
		"SELECT * FROM mentorexperience WHERE mentor_username = '" +
		req.session.username +
		"';" +
		"SELECT mentor_username, technical FROM mentorskills WHERE technical IS NOT NULL AND mentor_username = '" +
		req.session.username +
		"';" +
		"SELECT mentor_username, interpersonal FROM mentorskills WHERE interpersonal IS NOT NULL AND mentor_username = '" +
		req.session.username +
		"';" +
		"SELECT * FROM mentorinterest WHERE mentor_username = '" +
		req.session.username +
		"';" +
		"SELECT * FROM mentorpreference WHERE mentor_username = '" +
		req.session.username +
		"';" +
		"SELECT * FROM extra_mentor WHERE mentor_username = '" +
		req.session.username +
		"'";
	connection.query(sq, function (err, data, fields) {
		// console.log(data[7]);
		res.render("mentorProfile", { title: "User List", userData: data });
	});
	} else {
		res.redirect("error");
	}
});
/** edit phone number, email and bio for mentor */
app.post("/mentorPhone", function (request, response) {
	if (request.session.accounttype == "mentor" || request.session.admin){
	var phonenumber = request.body.phonenumber;
	var email = request.body.email;
	var bio = request.body.bio;
	var hidden = request.body.hidden;
	var selected_industry = request.body.select_industry;
	var username = request.session.username;
	connection.query(
		" UPDATE mentor SET phone_number = " +
		'"' +
		phonenumber +
		'"' +
		", email_address = " +
		'"' +
		email +
		'", hidden = "' +
		hidden +
		'"' +
		" WHERE mentor_username = " +
		'"' +
		username +
		'"; ' +
		" UPDATE extra_mentor SET bio = " +
		'"' +
		bio +
		'",' +
		"selected_industry = " +
		'"' +
		selected_industry +
		'"' +
		" WHERE mentor_username = " +
		'"' +
		username +
		'";',
		function (error, results) {
			if (error) throw error;
			if (request.session.admin) {
				response.redirect(307, "/mentorProfile");
			} else {
				response.redirect("/mentorProfile");
			}
		}
	);
	} else {
		response.redirect("error");
	}
});
/** edit social media links for mentor */
app.post("/uploadsocialmediaMentor", function (request, response) {
	if (request.session.accounttype == "mentor" || request.session.admin){
	var facebook_link = request.body.facebook;
	var linkedin_link = request.body.linkedin;
	var username = request.session.username;
	connection.query(
		" UPDATE extra_mentor SET facebook_link = " +
		'"' +
		facebook_link +
		'"' +
		',' +
		"linkedin_link = " +
		'"' +
		linkedin_link +
		'"' +
		" WHERE mentor_username = " +
		'"' +
		username +
		'";',
		function (error, results) {
			if (error) throw error;
			if (request.session.admin) {
				response.redirect(307, "/mentorProfile");
			} else {
				response.redirect("/mentorProfile");
			}
		}
	);
	} else {
		response.redirect("error");
	}
});
/** Add mentor education */
app.post("/mentorEducation", function (request, response) {
	if (request.session.accounttype == "mentor" || request.session.admin){
	var username = request.session.username;
	var level = request.body.level;
	var discipline = request.body.discipline;
	var institution = request.body.institution;
	connection.query("INSERT INTO mentoreducation VALUES (?,?,?,?);", [username, level, discipline, institution],
		function (error, results) {
			if (error) throw error;
			if (request.session.admin) {
				response.redirect(307, "/mentorProfile");
			} else {
				response.redirect("/mentorProfile");
			}
		}
	);
	} else {
		response.redirect("error");
	}
});
/** delete mentor education */
app.post("/mentorDeleteEducation", function (request, response) {
	if (request.session.accounttype == "mentor" || request.session.admin){
	var level = request.body.level1;
	var discipline = request.body.discipline1;
	var institution = request.body.institution1;
	var username = request.session.username;
	connection.query("DELETE FROM mentoreducation WHERE level = ? AND discipline = ? AND institution = ? AND mentor_username = ?", [level, discipline, institution, username],
		function (error, results) {
			if (error) throw error;
			if (request.session.admin) {
				response.redirect(307, "/mentorProfile");
			} else {
				response.redirect("/mentorProfile");
			}
		}
	);
	} else {
		response.redirect("error");
	}
});
/** add mentor experience */
app.post("/mentorExperience", function (request, response) {
	if (request.session.accounttype == "mentor" || request.session.admin){
	var username = request.session.username;
	var role = request.body.role;
	var organisation = request.body.organisation;
	var industry = request.body.industry;
	connection.query("INSERT INTO mentorExperience VALUES (?,?,?,?);", [username, role, organisation, industry],
		function (error, results) {
			if (error) throw error;
			if (request.session.admin) {
				response.redirect(307, "/mentorProfile");
			} else {
				response.redirect("/mentorProfile");
			}
		}
	);
	} else {
		response.redirect("error");
	}
});
/** delete mentor experience */
app.post("/mentorDeleteExperience", function (request, response) {
	if (request.session.accounttype == "mentor" || request.session.admin){
	var username = request.session.username;
	var role = request.body.role;
	var organisation = request.body.organisation;
	var industry = request.body.industry;
	connection.query("DELETE FROM mentorExperience WHERE role = ? AND organisation = ? AND industry = ? AND mentor_username = ?", [role, organisation, industry, username],
		function (error, results) {
			if (error) throw error;
			if (request.session.admin) {
				response.redirect(307, "/mentorProfile");
			} else {
				response.redirect("/mentorProfile");
			}
		}
	);
	} else {
		response.redirect("error");
	}
});
/** add mentor skills */
app.post("/mentorSkills", function (request, response) {
	if (request.session.accounttype == "mentor" || request.session.admin){
	var username = request.session.username;
	var type = request.body.skillType;
	var description = request.body.skillDescription;
	connection.query("INSERT INTO mentorSkills(mentor_username, " + type + ")" + "VALUES (" +
		'"' +
		username +
		'"' +
		"," +
		'"' +
		description +
		'"' +
		");",
		function (error, results) {
			if (error) throw error;
			if (request.session.admin) {
				response.redirect(307, "/mentorProfile");
			} else {
				response.redirect("/mentorProfile");
			}
		}
	);
	} else {
		response.redirect("error");
	}
});
/** delete mentor technical skills */
app.post("/mentorDeleteTechnical", function (request, response) {
	if (request.session.accounttype == "mentor" || request.session.admin){
	var technical = request.body.technical;
	var username = request.session.username;
	connection.query("DELETE FROM mentorSkills WHERE technical = ? AND mentor_username = ?", [technical, username],
		function (error, results) {
			if (error) throw error;
			if (request.session.admin) {
				response.redirect(307, "/mentorProfile");
			} else {
				response.redirect("/mentorProfile");
			}
		}
	);
	} else {
		response.redirect("error");
	}
});
/** delete mentor interpersonal skills */
app.post("/mentorDeleteInterpersonal", function (request, response) {
	if (request.session.accounttype == "mentor" || request.session.admin){
	var interpersonal = request.body.interpersonal;
	var username = request.session.username;
	connection.query("DELETE FROM mentorSkills WHERE interpersonal = ? AND mentor_username = ?", [interpersonal, username],
		function (error, results) {
			if (error) throw error;
			if (request.session.admin) {
				response.redirect(307, "/mentorProfile");
			} else {
				response.redirect("/mentorProfile");
			}
		}
	);
	} else {
		response.redirect("error");
	}
});
/** add mentor interest */
app.post("/mentorInterest", function (request, response) {
	if (request.session.accounttype == "mentor" || request.session.admin){
	var username = request.session.username;
	var interest = request.body.interest;
	connection.query("INSERT INTO mentorInterest VALUES (?,?);", [username, interest],
		function (error, results) {
			if (error) throw error;
			if (request.session.admin) {
				response.redirect(307, "/mentorProfile");
			} else {
				response.redirect("/mentorProfile");
			}
		}
	);
	} else {
		response.redirect("error");
	}
});
/** delete mentor interest */
app.post("/mentorDeleteInterest", function (request, response) {
	if (request.session.accounttype == "mentor" || request.session.admin){
	var interest = request.body.interest;
	var username = request.session.username;
	connection.query(
		"DELETE FROM mentorinterest WHERE interests = ? AND mentor_username = ?", [interest, username],
		function (error, results) {
			if (error) throw error;
			if (request.session.admin) {
				response.redirect(307, "/mentorProfile");
			} else {
				response.redirect("/mentorProfile");
			}
		}
	);
	} else {
		response.redirect("error");
	}
});
/** add mentor interest */
app.post("/mentorPreference", function (request, response) {
	if (request.session.accounttype == "mentor" || request.session.admin){
	var username = request.session.username;
	var capacity = request.body.capacity;
	var meetingTime = request.body.duration;
	var timeAvailable = request.body.timeAvailable;
	var relationship = request.body.relationship;
	connection.query(
		"INSERT IGNORE INTO mentorPreference VALUES (" +
		'"' +
		username +
		'"' +
		"," +
		capacity +
		"," +
		meetingTime +
		"," +
		'"' +
		timeAvailable +
		'"' +
		"," +
		'"' +
		relationship +
		'"' +
		");" +
		"UPDATE mentorpreference SET capacity = " +
		capacity +
		", meetingTime = " +
		meetingTime +
		", timeAvailable = " +
		'"' +
		timeAvailable +
		'",' +
		"relationship = " +
		'"' +
		relationship +
		'"' +
		"WHERE mentor_username = " +
		'"' +
		username +
		'"',
		function (error, results) {
			if (error) throw error;
			if (request.session.admin) {
				response.redirect(307, "/mentorProfile");
			} else {
				response.redirect("/mentorProfile");
			}
		}
	);
	} else {
		response.redirect("error");
	}
});

/**Login authorisation
  * login Authorisation for a mentor */
app.post('/mentorauth', function (request, response) {
	var username = request.body.username;
	var password = request.body.password;
	if (username && password) {
		connection.query('SELECT password FROM mentor WHERE mentor_username = ?', [username], async function (error, results, fields) {
			if (undefined !== results[0]) {
				const validPass = await bcrypt.compare(password, results[0].password);
				if (validPass) {
					request.session.regenerate(function (err) { });
					request.session.loggedin = true;
					request.session.username = username;
					request.session.accounttype = "mentor";
					response.redirect("/mentorHome");
				} else {
					const data = {
						error: "Incorrect Username and/or Password",
					};
					response.render("mentor-login", { userData: data });
				}
			} else {
				const data = {
					error: "An account with that username does not exists",
				};
				response.render("mentor-login", { userData: data });
			}
			response.end();
		});
	} else {
		response.send('Please enter Username and Password!');
		response.end();
	}
});
/** login Authorisation for a mentee */
app.post('/menteeauth', function (request, response) {
	var username = request.body.username;
	var password = request.body.password;
	if (username && password) {
		connection.query('SELECT password FROM mentee WHERE mentee_username = ?', [username], async function (error, results, fields) {
			if (undefined !== results[0]) {
				const validPass = await bcrypt.compare(password, results[0].password);
				if (validPass) {
					request.session.regenerate(function (err) { });
					request.session.loggedin = true;
					request.session.username = username;
					request.session.accounttype = "mentee";
					response.redirect("/menteeHome");
				} else {
					const data = {
						error: "Incorrect Password",
					};
					response.render("mentee-login", { userData: data });
				}
			} else {
				const data = {
					error: "An account with that username does not exist",
				};
				response.render("mentee-login", { userData: data });
			}
			response.end();
		});
	} else {
		response.send('Please enter Username and Password!');
		response.end();
	}
});
/** login Authorisation for a admin */
app.post("/adminauth", function (request, response) {
	var username = request.body.username;
	var password = request.body.password;
	if (username && password) {
		connection.query(
			"SELECT * FROM admin WHERE username = ? AND password = ?",
			[username, password],
			function (error, results, fields) {
				if (error) throw error;
				if (results.length > 0) {
					request.session.regenerate(function (err) {
					})
					request.session.loggedin = true;
					request.session.username = username;
					request.session.admin = true;
					response.redirect("/admin-home");
				} else {
					response.send("Incorrect Username and/or Password!");
				}
				response.end();
			}
		);
	} else {
		response.send("Please enter Username and Password!");
		response.end();
	}
});

/**Registration
 * register mentee account */
app.post('/registerMentee', async (request, response) => {
	const salt = await bcrypt.genSalt(10);
	newpassword = await bcrypt.hash(request.body.password, salt);
	connection.query("INSERT INTO mentee (mentee_username,password,first_name,surname,email_address,phone_number) VALUES( " +
		'"' + request.body.username + '",'
		+ '"' + newpassword + '",'
		+ '"' + request.body.firstname + '",'
		+ '"' + request.body.lastname + '",'
		+ '"' + request.body.email + '",'
		+ '"' + request.body.phonenumber + '"' + ");"
		+ "INSERT INTO extra_mentee VALUES (" +
		'"' + request.body.username + '",' +
		'"","","","");',
		function (error, results) {
			if (error) {
				if (error.code == 'ER_DUP_ENTRY' || error.errno == 1062) {
					const data = { error: 'An account with that username already exists' }
					response.render("mentee-signup", { userData: data });
				} else {
					throw error;
				}
			} else {
				return response.redirect('/menteelogin');
			}
		})
});
/** register mentor account */
app.post('/registerMentor', async (request, response) => {
	const salt = await bcrypt.genSalt(10);
	newpassword = await bcrypt.hash(request.body.password, salt);
	connection.query("INSERT INTO mentor (mentor_username,password,first_name,surname,email_address,phone_number) VALUES( " +
		'"' + request.body.username + '",'
		+ '"' + newpassword + '",'
		+ '"' + request.body.firstname + '",'
		+ '"' + request.body.lastname + '",'
		+ '"' + request.body.email + '",'
		+ '"' + request.body.phonenumber + '"' + ");"
		+ "INSERT INTO extra_mentor VALUES (" +
		'"' + request.body.username + '",' +
		'"","","","");',
		function (error, results) {
			if (error) {
				if (error.code == 'ER_DUP_ENTRY' || error.errno == 1062) {
					const data = { error: 'An account with that username already exists' }
					response.render("mentor-signup", { userData: data });
				} else {
					throw error;
				}
			} else {
				return response.redirect('/mentorlogin');
			}
		})
});
/** add data to db for Mentor */
app.post("/Mentorinformation", function (request, response) {
	if (request.session.accounttype == "mentor" || request.session.admin){
	var mentor_username = request.session.username;
	var bio = request.body.bio;
	var level = request.body.level;
	var discipline = request.body.discipline;
	var institution = request.body.institution;
	var role = request.body.role;
	var organisation = request.body.organisation;
	var technical = request.body.technical;
	var interpersonal = request.body.interpersonal;
	var interest = request.body.interest;
	var mentee_capacity = request.body.mentee_capacity;
	var meeting_time_available = request.body.meeting_time_available;
	var mentorship_relationship = request.body.mentorship_relationship;
	connection.query(
		"INSERT INTO extra_mentor VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?);",
		[mentor_username, bio, level, discipline, institution, role, organisation, technical, interpersonal, interest, mentee_capacity, meeting_time_available, mentorship_relationship],
		function (error, results) {
			if (error) throw error;
			response.redirect("/home");
		}
	);
	} else {
		response.redirect("error");
	}
});

/** Display and search
 * Nomination display */
app.get("/displayAd", function (req, res, next) {
	if (req.session.accounttype == "mentee"){
	var sq = "SELECT mentor_username, first_name, surname, email_address, phone_number, imagepath, hidden FROM mentor WHERE hidden = true ";
	connection.query(sq, function (err, data, fields) {
		// console.log(err);
		res.render("displayAd", { title: "User List", userData: data });
	});
	} else {
		res.redirect("error");
	}
});
/** Nomination display for admin */
app.get("/admin-search", function (req, res, next) {
	if (req.session.admin){
	var sq = "SELECT mentor_username, first_name, surname, email_address, phone_number, imagepath, hidden FROM mentor";
	connection.query(sq, function (err, data, fields) {
		console.log(err);
		res.render("admin-search", { title: "User List", userData: data });
	});
	} else {
		res.redirect("error");
	}
});

app.get("/search", function (req, res) {
	if (req.session.loggedin){
	var search = req.query.search;
	var filter = req.query.filter;
	var table_name = filter.split(" ")[0];
	var category = filter.split(" ")[1];
	if (table_name == "mentor") {
		connection.query(
			"SELECT mentor_username, first_name, surname, email_address, phone_number, imagepath, hidden FROM mentor where hidden = true AND " + category + " LIKE " +
			"'" +
			"%" +
			search +
			"%" +
			"'",
			function (err, data) {
				if (err) console.log(err);
				res.render("displayAd", { title: "User List", userData: data });
			}
		);
	} else {
		connection.query(
			"SELECT distinct mentor_username, first_name, surname, email_address, phone_number,imagepath FROM mentor where hidden = true AND mentor_username IN (" +
			"SELECT mentor_username FROM " + table_name + " WHERE " + category + " LIKE " +
			"'" +
			"%" +
			search +
			"%" +
			"')",
			function (err, data) {
				if (err) console.log(err);
				res.render("displayAd", { title: "User List", userData: data });
			});
	}
	} else {
		res.redirect("error");
	}
});
/** Ability to view the mentor */
app.get("/viewMentor", function (req, res, next) {
	if (req.session.admin || req.session.accounttype == "mentee"){
	var mentor_username = req.query.username;
	connection.query(
		"SELECT mentor_username, first_name, surname, email_address, phone_number, imagepath, hidden FROM mentor WHERE mentor_username = '" +
		mentor_username +
		"';" +
		"SELECT * FROM mentoreducation WHERE mentor_username = '" +
		mentor_username +
		"';" +
		"SELECT * FROM mentorexperience WHERE mentor_username = '" +
		mentor_username +
		"';" +
		"SELECT mentor_username, technical FROM mentorskills WHERE technical IS NOT NULL AND mentor_username = '" +
		mentor_username +
		"';" +
		"SELECT mentor_username, interpersonal FROM mentorskills WHERE interpersonal IS NOT NULL AND mentor_username = '" +
		mentor_username +
		"';" +
		"SELECT * FROM mentorinterest WHERE mentor_username = '" +
		mentor_username +
		"';" +
		"SELECT * FROM mentorpreference WHERE mentor_username = '" +
		mentor_username +
		"';" +
		"SELECT * FROM extra_mentor WHERE mentor_username = '" +
		mentor_username +
		"';" +
		"SELECT * FROM Matches WHERE  mentee_username = '" +
		req.session.username +
		"' AND mentor_username = '" +
		mentor_username + "';" +
		"SELECT * FROM Matches WHERE mentee_username = '" +
		req.session.username +
		"' AND mentor_approval = true AND admin_approval = true ;"
		,function (err, data, fields) {
		res.render("viewMentor", { title: "User List", userData: data });
		});
	} else {
		res.redirect("error");
	}
});
/** Ability to view mentee */
app.get("/viewMentee", function (req, res, next) {
	if (req.session.accounttype == "mentor" || req.session.admin){
	var mentee = req.query.username;
	connection.query(
		"SELECT mentee_username, first_name, surname, email_address, phone_number, imagepath FROM mentee WHERE mentee_username = '" +
		mentee +
		"';" +
		"SELECT * FROM menteeeducation WHERE mentee_username = '" +
		mentee +
		"';" +
		"SELECT * FROM menteeexperience WHERE mentee_username = '" +
		mentee +
		"';" +
		"SELECT mentee_username, technical FROM menteeskills WHERE technical IS NOT NULL AND mentee_username = '" +
		mentee +
		"';" +
		"SELECT mentee_username, interpersonal FROM menteeskills WHERE interpersonal IS NOT NULL AND mentee_username = '" +
		mentee +
		"';" +
		"SELECT * FROM menteeinterest WHERE mentee_username = '" +
		mentee +
		"';" +
		"SELECT * FROM extra_mentee WHERE mentee_username = '" +
		mentee +
		"';",function (err, data, fields) {
		res.render("viewMentee", { title: "User List", userData: data });
		});
	} else {
		res.redirect("error");
	}
});

/** Logout */
app.get("/logout", function (request, response) {
	request.session.destroy(function (err) {
		if (err) console.log(err)
		response.render("index")
	})
});

/** Admin deleting users
 * Delete mentee */
app.post('/deleteMentee', function (request, response) {
	if (request.session.admin) {
	// var user = request.params.id; 
	var user = request.body.id;
	connection.query(
		"DELETE FROM mentee WHERE mentee_username = ? ", [user],
		function (error, results) {
			if (error) throw error;
			response.redirect("/admin-home");
		}
	);
	} else {
		response.redirect("error");
	}
});
/** Delete mentor */
app.post('/deleteMentor', function (request, response) {
	if (request.session.admin) {
	// var user = request.params.id; 
	var user = request.body.id;
	connection.query(
		"DELETE FROM mentor WHERE mentor_username = ? ", [user],
		function (error, results) {
			if (error) throw error;
			response.redirect("/admin-home");
		}
	);
	} else {
		response.redirect("error");
	}
});

/** Profile pictures
 * Mentee ability to upload profile picture  */
 app.post('/menteeupload', (req, res) => {
	if (req.session.accounttype == "mentee" || req.session.admin) {
	// Get the file that was set to our field named "image"
	if (req.files != null) {
	const { image } = req.files;
	// If no image submitted, exit
	if (!image) return res.sendStatus(400);
	// If does not have image mime type prevent from uploading
	if (image.mimetype.toString() != 'image/png' && image.mimetype.toString() != 'image/gif' && image.mimetype.toString() != 'image/jpeg') return res.sendStatus(400);
	// Move the uploaded image to our upload folder
	var menteeusername = req.body.username.toString();
	const map = new Map();
	map.set('image/png', '.png');
	map.set('image/gif', '.gif');
	map.set('image/jpeg', '.jpg');
	image.mv(viewPath + '/menteeupload/' + menteeusername + map.get(image.mimetype.toString()));
	connection.query("UPDATE mentee SET imagepath = ? WHERE mentee_username = ?", ["menteeupload/" + menteeusername + map.get(image.mimetype.toString()), menteeusername],
		function (error, results) {
			if (error) throw error;
			if (req.session.admin) {
				res.redirect(307, "/menteeProfile");
			} else {
				res.redirect("/menteeProfile");
			}
		});
	} else {
		if (req.session.admin) {
			res.redirect(307, "/menteeProfile");
		} else {
			res.redirect("/menteeProfile");
		}
	}
	} else {
		res.redirect("error");
	}
});
/** Mentor ability to upload profile picture  */
/** Mentor ability to upload profile picture  */
app.post('/mentorupload', (req, res) => {
	if (req.session.accounttype == "mentor" || req.session.admin) {
	// Get the file that was set to our field named "image"
	if (req.files != null) {
	const { image } = req.files;
	// If no image submitted, exit
	if (!image) return res.sendStatus(400);
	// If does not have image mime type prevent from uploading
	if (image.mimetype.toString() != 'image/png' && image.mimetype.toString() != 'image/gif' && image.mimetype.toString() != 'image/jpeg') return res.sendStatus(400);
	// Move the uploaded image to our upload folder
	var mentorusername = req.body.username.toString();
	const map = new Map();
	map.set('image/png', '.png');
	map.set('image/gif', '.gif');
	map.set('image/jpeg', '.jpg');
	image.mv(viewPath + '/mentorupload/' + mentorusername + map.get(image.mimetype.toString()));
	connection.query("UPDATE mentor SET imagepath = ? WHERE mentor_username = ?", ["mentorupload/" + mentorusername + map.get(image.mimetype.toString()), mentorusername],
		function (error, results) {
			if (error) throw error;
			if (req.session.admin) {
				res.redirect(307, "/mentorProfile");
			} else {
				res.redirect("/mentorProfile");
			}
		});
	} else {
		if (req.session.admin) {
			res.redirect(307, "/mentorProfile");
		} else {
			res.redirect("/mentorProfile");
		}
	}
	} else {
		res.redirect("error");
	}
});

app.listen(3000);