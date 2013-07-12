// Whether Current Tab Has Focus
var tab_has_focus = false;

// Leap Motion Settings
var last_frame;
var scene;
var action = null;
var last_action = null;
var start_action = 0;
var intent = false;
var delay_between_actions = 1;
var timeout = null;

// Track Leap Motion Connection
var now, last_poll = new Date().getTime() / 1000;
var connection;
var connection_lost_after = 5;

// Settings for Scroll Events
var width = window.innerWidth;
var height = window.innerHeight;
var scroll_speed = 20;
var scroll_smoothing = 4;

// Size for Finger Rendering in Pixels
var finger_size = 32;

// Colors for Fingers
var rainbow = new Array('#F80C12', '#FF3311', '#FF6644', '#FEAE2D', '#D0C310', '#69D025', '#12BDB9', '#4444DD', '#3B0CBD', '#442299');
var leap = '#9AC847';
var dark = '#000000';
var light = '#FFFFFF';

// Setup Default Settings for Leap Motion
var leap_motion_settings = {
	'fingers': 'yes',
	'color': 'rainbow',
	'scrolling': 'enabled',
	'history': 'enabled',
	'zoom': 'disabled',
	'rotation': 'disabled'
};

// Update Settings from Browser Extension
update_settings();

// called when a tab is updated (like changed away from, or refreshed, or loaded)
chrome.storage.onChanged.addListener(update_settings);

// Once Settings are Updates, Initialize Extension
function init()
{
	if(leap_motion_settings.fingers === 'yes')
	{
		add_fingers();
	}

	setInterval(check_focus, 1000);
	connection = setInterval(check_connection, 1000);
}

// Sometimes The Connection Dies, and Leap Motion Needs to be Restarted
function check_connection()
{
	now = new Date().getTime() / 1000;
	if(now - last_poll > connection_lost_after)
	{
		clearInterval(connection);

		try {
			chrome.runtime.sendMessage({ connection: 'lost' }, function(response) {
				console.error('Connection to Leap Motion Lost. Restart Leap Motion and Refresh Page.');

				$('body').append('<div class="leap_mostion_connection" style="display: none;"><\/div>');
				$('.leap_mostion_connection').html('<b>ATTENTION:<\/b> Connection to Leap Motion Lost. Restart Leap Motion and Refresh Page.').css({
					'position': 'fixed',
					'top': '0',
					'left': '0',
					'width': '100%',
					'color': '#222',
					'text-align': 'center',
					'height': '30px',
					'z-index': '1000',
					'line-height': '30px',
					'background-color': '#9AC847'
				}).fadeIn('slow');

				$('.leap_mostion_connection').click(function(){ $(this).fadeOut('slow'); });
			});
		}
		catch(error) {
			console.error(error.message);
		}
	}
}

// Check if Current Tab has Focus, and only run this extension on the active tab
function check_focus()
{
	try {
		chrome.runtime.sendMessage({ tab_status: 'current' }, function(response) {
			if(response.active && window.location.href == response.url && document.hasFocus())
			{
				tab_has_focus = true;
			}
			else
			{
				tab_has_focus = false;
			}
		});
	}
	catch(error) {
		// If you clicked to reload this extension, you will get this error, which a refresh fixes
		if(error.message.indexOf('Error connecting to extension') !== -1)
		{
			document.location.reload(true);
		}
		// Something else went wrong... I blame Grumpy Cat
		else
		{
			console.error(error.message);
		}
	}
}

// Add DOM Elements to Page to Render Fingers
function add_fingers()
{
	for(var i=0; i<10; i++)
	{
		$('body').append('<div class="finger" id="finger'+ (i+1) +'"><\/div>');

		switch(leap_motion_settings.color)
		{
			case 'rainbow':
				$('#finger'+ (i+1) +'').css({
					'background-color': rainbow[i],
					'-webkit-box-shadow': 'inset 0px 0px 1px 1px rgba(0, 0, 0, 0.25)',
					'box-shadow': 'inset 0px 0px 1px 1px rgba(0, 0, 0, 0.25)'
				});
				break;

			case 'leap':
				$('#finger'+ (i+1) +'').css({
					'background-color': leap,
					'-webkit-box-shadow': 'inset 0 0 5px #000',
					'box-shadow': 'inner 0 0 5px #000'
				});
				break;

			case 'dark':
				$('#finger'+ (i+1) +'').css({
					'background-color': dark,
					'-webkit-box-shadow': 'inset 0px 0px 1px 1px rgba(255, 255, 255, 0.5)',
					'box-shadow': 'inset 0px 0px 1px 1px rgba(255, 255, 255, 0.5)'
				});
				break;

			case 'light':
				$('#finger'+ (i+1) +'').css({
					'background-color': light,
					'-webkit-box-shadow': 'inset 0px 0px 1px 1px rgba(0, 0, 0, 0.25)',
					'box-shadow': 'inset 0px 0px 1px 1px rgba(0, 0, 0, 0.25)'
				});
				break;
		}
	}

	$('.finger').css({
		'width': finger_size + 'px',
		'height': finger_size + 'px',
		'opacity': '0',
		'position': 'absolute',
		'-webkit-border-radius': Math.ceil(finger_size/2) + 'px',
		'border-radius': Math.ceil(finger_size/2) + 'px',
		'z-index': '10000',
		'-webkit-transition': 'opacity 0.15s ease',
		'transition': 'opacity 0.15s ease',
		'-webkit-box-sizing': 'border-box',
		'box-sizing': 'border-box',
		'transform': 'translate3d(0,0,0)'
	});
}

// Track Finger Movement and Update in Real Time
function update_fingers(scale, frame)
{
	$('.finger').css({ 'opacity': '0' });

	if( !tab_has_focus)
	{
		return;
	}

	var scaled_size = Math.ceil(finger_size * scale);
	var scaled_half = Math.ceil(scaled_size / 2);

	// Make sure there are at least two fingers to render, since that is the minimum for an action
	// Also prevents forehead / face from registering as a finger during typing
	if(frame.fingers.length > 1)
	{
		for(var j=0; j<frame.fingers.length; j++)
		{
			var top = ( height / 2 ) - frame.fingers[j].tipPosition.y;
			var left = ( width / 2 ) + frame.fingers[j].tipPosition.x;

			$('#finger' + (j+1)).css({
				'top': 0,
				'left': 0,
				'position': 'fixed',
				'transform': 'translate3d('+left.toFixed(2)+'px, '+top.toFixed(2)+'px, 0)',
				'opacity': '0.75'
			});
		}
	}
}

// Two Finger Page Scrolling
function scroll_page(pointables)
{
	if( !tab_has_focus || pointables === undefined || pointables.length === 0 || last_frame === undefined || last_frame.pointables.length === 0)
	{
		return;
	}

	var finger = pointables[0];
	var last_finger = last_frame.pointables[0];


	var horizontal_translation = 0;
	var horizontal_delta = finger.tipPosition.x - last_finger.tipPosition.x;

	var vertical_translation = 0;
	var vertical_delta = finger.tipPosition.y - last_finger.tipPosition.y;

	if (horizontal_delta > 10)
	{
		horizontal_translation = scroll_speed;
	}
	else if (horizontal_delta < 10)
	{
		horizontal_translation = -scroll_speed;
	}

	if (vertical_delta > scroll_smoothing)
	{
		vertical_translation = scroll_speed;
	}
	else if (vertical_delta < -scroll_smoothing)
	{
		vertical_translation = -scroll_speed;
	}

	window.scrollBy(horizontal_translation, vertical_translation);
}

// Look for Hand Gestures to Navigate History
function navigate_history(gesture)
{
	if( !tab_has_focus || typeof gesture === 'undefined')
	{
		return;
	}

	if (gesture.type === 'swipe' && gesture.state === 'stop')
	{
		if (gesture.direction.x > 0)
		{
			history.forward();
			console.log('Next Page');
		}
		else
		{
			history.back();
			console.log('Previous Page');
		}
	}
}

// Look for Hand Gestures to Transform Page
function page_transform(hands)
{
	if ( !tab_has_focus || hands === undefined || hands.length === 0 || (leap_motion_settings.zoom === 'disabled' && leap_motion_settings.rotation === 'disabled'))
	{
		return;
	}

	var hand = hands[0];
	var rotation = (Math.atan(-hand.palmNormal.x, -hand.palmNormal.y)) * (180 / Math.PI);

	// Both Zoom and Rotation are Enables
	if(leap_motion_settings.zoom === 'enabled' && leap_motion_settings.rotation === 'enabled')
	{
		$('html').css({
			'transform': 'scale(' + hand._scaleFactor + ') rotate('+ rotation +'deg) translateZ(0)', /* W3C */
			'-webkit-transform': 'scale(' + hand._scaleFactor + ') rotate('+ rotation +'deg) translateZ(0)',
			'transformation-origin': 'center center'
		});
	}
	// Only Zoom is Enabled
	else if(leap_motion_settings.zoom === 'enabled' && leap_motion_settings.rotation === 'disabled')
	{
		$('html').css({
			'transform': 'scale(' + hand._scaleFactor + ') translateZ(0)', /* W3C */
			'-webkit-transform': 'scale(' + hand._scaleFactor + ') translateZ(0)',
			'transformation-origin': 'center center'
		});
	}
	// Only Rotation is Enabled
	else if(leap_motion_settings.zoom === 'disabled' && leap_motion_settings.rotation === 'enabled')
	{
		$('html').css({
			'transform': 'rotate('+ rotation +'deg) translateZ(0)', /* W3C */
			'-webkit-transform': 'rotate('+ rotation +'deg) translateZ(0)',
			'transformation-origin': 'center center'
		});
	}
}

// Fetch Settings from Local Storage
function update_settings()
{
	// Fetch Leap Motion Settings for Fingers
	chrome.storage.local.get('leap_motion_fingers', function(fetchedData) {
		if(typeof fetchedData.leap_motion_fingers !== 'undefined')
		{
			leap_motion_settings.fingers = fetchedData.leap_motion_fingers;
		}
	});

	// Fetch Leap Motion Settings for Color
	chrome.storage.local.get('leap_motion_color', function(fetchedData) {
		if(typeof fetchedData.leap_motion_color !== 'undefined')
		{
			leap_motion_settings.color = fetchedData.leap_motion_color;
		}
	});

	// Fetch Leap Motion Settings for Scrolling
	chrome.storage.local.get('leap_motion_scrolling', function(fetchedData) {
		if(typeof fetchedData.leap_motion_scrolling !== 'undefined')
		{
			leap_motion_settings.scrolling = fetchedData.leap_motion_scrolling;
		}
	});

	// Fetch Leap Motion Settings for History
	chrome.storage.local.get('leap_motion_history', function(fetchedData) {
		if(typeof fetchedData.leap_motion_history !== 'undefined')
		{
			leap_motion_settings.history = fetchedData.leap_motion_history;
		}
	});

	// Fetch Leap Motion Settings for Zoom
	chrome.storage.local.get('leap_motion_zoom', function(fetchedData) {
		if(typeof fetchedData.leap_motion_zoom !== 'undefined')
		{
			leap_motion_settings.zoom = fetchedData.leap_motion_zoom;
		}
	});

	// Fetch Leap Motion Settings for Rotation
	chrome.storage.local.get('leap_motion_rotation', function(fetchedData) {
		if(typeof fetchedData.leap_motion_rotation !== 'undefined')
		{
			leap_motion_settings.rotation = fetchedData.leap_motion_rotation;
		}

		// Run initialization after last setting pulled from local storage
		init();
	});
}

// Connect to Leap Motion via Web Socket and Manage Actions
Leap.loop({enableGestures: true}, function (frame, done){

	last_poll = new Date().getTime() / 1000;

	// Update Finger Position
	if(leap_motion_settings.fingers === 'yes')
	{
		var scale = (frame.hands.length > 0 && frame.hands[0]._scaleFactor !== 'undefined') ? frame.hands[0]._scaleFactor : 1;
		update_fingers(scale, frame);
	}
	else
	{
		$('.finger').css({ 'opacity': '0' });
	}

	// Try to detect User Intent to reduce firing events not intended ( less jumpy page is good )
	var now = new Date().getTime() / 1000;

	if(start_action === 0)
	{
		start_action = new Date().getTime() / 1000;
	}

	var offset = now - start_action;

	// If nothing is happening, reset interaction
	if (frame.pointables === undefined)
	{
		action = null;
		clearTimeout(timeout);
		return;
	}

	// Look for Swipe Gesture
	if (frame.gestures && frame.gestures.length > 0)
	{
		action = 'gesture';
	}
	// Look for Scrolling Gesture
	else if (frame.pointables.length === 2)
	{
		action = 'scroll';
	}
	// Look for Page Transform Gesture
	else if (frame.pointables.length > 2)
	{
		action = 'transform';
	}
	// Nothing is happening, reset actions
	else
	{
		action = null;
		clearTimeout(timeout);
	}


	if(action === last_action && offset >= delay_between_actions)
	{
		intent = true;
	}
	else if(action !== last_action && offset >= delay_between_actions)
	{
		intent = false;
		start_action = 0;
		clearTimeout(timeout);
	}

	if(intent)
	{
		switch(action)
		{
			case 'gesture':
				timeout = setTimeout(function(){ navigate_history(frame.gestures[0]); }, 250);
				break;

			case 'scroll':
				timeout = setTimeout(function(){ scroll_page(frame.pointables); }, 250);
				break;

			case 'transform':
				timeout = setTimeout(function(){ page_transform(frame.hands); }, 250);
				break;
		}
	}

	if (frame !== undefined && frame.pointables !== undefined && frame.pointables.length > 0)
	{
		last_frame = frame;
		last_action = action;
	}

	done();
});

