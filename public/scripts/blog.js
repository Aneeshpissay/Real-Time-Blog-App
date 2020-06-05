
var socket = io();
function blog(){
	socket.emit("blogSent",{
		"user_name1": document.getElementById("user_name1").value,
		"title": document.getElementById("title").value
	})
}

socket.on("blogSent",function(message){
	$.notify("New Blog Post: " + message.title + "\nFrom: " + message.user_name1,{
		autoHide: false,
		className: "info"
	})
})