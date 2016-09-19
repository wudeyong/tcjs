define(function(require, exports, module){
	
	var $		= require('cdn/$'),
		undefined;

	var defaultParmas	=	{
		iframeID : 'iframe-post-form',
		json : false,
		src:	'',
		post : function () {},    
		complete : function (response) {}
	};
	
	var ajaxPostForm = function (options){
		var response,
			returnReponse,
			element,
			status = true,
			iframe;

		options = $.extend({}, defaultParmas, options);

		if (!$('#' + options.iframeID).length){
			if(options.src){
				$('body').append('<iframe id="' + options.iframeID + '" name="' + options.iframeID + '" src="'+options.src +'"style="display:none" />');
			}else{
				$('body').append('<iframe id="' + options.iframeID + '" name="' + options.iframeID + '" style="display:none" />');
			}
		}
		
		
			iframe = $('#' + options.iframeID);
			iframe.on('load',function (){
					
					response = $(iframe[0].contentDocument.body);
					
					if (options.json && $.parseJSON){
						returnReponse = $.parseJSON(response.html());
					}

					else{
						returnReponse = response.html();
					}

					options.complete.apply(this, [returnReponse]);
					iframe.unbind('load');
					setTimeout(function (){
						response.html('');
					}, 1);
				});
			
			$(this).each(function (){
				element = $(this);
				element.attr('target', options.iframeID);
					
					
				element.submit(function (){
					
					status = options.post.apply(this);
					
					if (status === false){
						return status;
					}
				
			});
		});
	};
	exports.post = ajaxPostForm;
	
});


	


	

/*  |xGv00|6708a1c7fd8de64b7c527f3235f02fdb */