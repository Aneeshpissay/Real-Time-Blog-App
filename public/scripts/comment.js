
var socket = io();
function doComment(form){
		var formComment = {comment_id: form.comment_id.value,user_name: form.user_name.value,message: form.message.value};
		socket.emit("new_comment", formComment);
}

var datetime = moment().utcOffset("+05:30").format('MMMM Do YYYY, h:mm:ss a')
var ago = moment().utcOffset("+05:30").fromNow();

socket.on("new_comment", comment=>{
	if(comment.comment_id!=$("#comment_id").val()){
		return;
	}
	var html = "";
		html+=`<div class="row">`
		html+=`<div class="text-left pl-5 col-md-12">`
		html+=`<div class="user"><h5 class="username">`
		html+=comment.user_name
		html+=`</h5></div>`
		html+=`<span class="date badge badge-pill badge-light">`
		html+=datetime
		html+=`</span>`
		html+=`<span class="date badge badge-pill badge-light">`
		html+=ago
		html+=`</span>`
		html+=`<div class="comment"><h5>`
		html+=comment.message
		html+=`</h5></div>`
		html+=`<hr>`
		html+=`</div>`
		html+=`</div>`
		$(".comnt").append(html);
		var scroll = document.getElementById('scroll');
		scroll.scrollTop = scroll.scrollHeight;
})

function web(){
	socket.emit("messageSent",{
		"user_name": document.getElementById("user_name").value,
		"message": document.getElementById("message").value
	})
}

socket.on("messageSent",function(message){
	$.notify("New Comment: " + message.message + "\n\nFrom: " + message.user_name,{
		autoHide: false,
		className: "info"
	})
})