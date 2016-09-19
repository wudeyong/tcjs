//日期工具类

define(function(require, exports, module){
	return new function(){
		this.CHINA_BEIJING_TIMEZONE = -480;
		this.MS_PER_DAY = 24 * 3600 * 1000;

		//默认为GMT+8区
		this._defaultTimezone = -480;
		this._defaultFormat = 'YYYY-MM-DD hh:mm:ss';
		this._msperday = 24 * 3600 * 1000;
		this._mspermin = 60 * 1000;

		/**
		 * 根据给定的日期数据获得一个日期对象，对给定日期的解读以timezone为准，默认为东八区
		 * @param  {Array} dateArr [year, month, date, hours, minutes, seconds, miliseconds]
		 * @param  {int} timezone
		 * @return {Date}
		 */
		this.getDate = function(dateArr, timezone){
			var 
				date 		= new Date(Date.UTC.apply(null, dateArr)),
				time 		= date.getTime();

			timezone = timezone == null ? this._defaultTimezone : timezone;

			date.setTime(time + timezone * this._mspermin);

			return date;
		};

		/**
		 * 根据日期字符串获得一个日期对象，对日期字符串的解读以timezone为准，格式由format说明，默认为东八区
		 * @param  {String} dataStr
		 * @param  {String} format
		 * @param  {int} timezone
		 * @return {Date}
		 */
		this.getDateInStr = function(dateStr, format, timezone){
			var 
				dateKeys 	= this._defaultFormat.split(/-|\s|:/),
				idxMap 		= {},
				idx 		= 0,
				dateArr 	= [],
				date,
				i;

			if(!dateStr){
				return this.getDate([], timezone);
			}

			if(!format){
				format = 'YYYY-MM-DD hh:mm:ss';
			}

			format = format.replace(/(Y{2}?Y{2})|M{2}|D{2}|h{2}|m{2}|s{2}/g, function(){
				var
					key = arguments[0];

				idxMap[key] = idx++;

				return '(\\d{' + key.length + '})';
			});

			dateStr.replace(new RegExp(format), function(){
				for(i = 0; i < dateKeys.length; i++){
					idxMap[dateKeys[i]] != null ? dateArr.push(arguments[idxMap[dateKeys[i]] + 1]) : dateArr.push(0);
					
					if(dateKeys[i] === 'MM'){
						dateArr[dateArr.length - 1]--;
					}
				}
			});

			return this.getDate(dateArr, timezone);
		};

		/**
		 * 已给定的时区格式化日期
		 * @param  {Date} date
		 * @param  {String} format
		 * @param  {int} timezone
		 * @return {String}
		 */
		this.formatDate = function(date, format, strict, timezone){
			date = this.cloneDate(date);
			strict = strict == null ? true : strict;

			var 
				valueMap 	= {};

			format = format || this._defaultFormat;
			timezone = timezone == null ? this._defaultTimezone : timezone;

			valueMap = this.getDateValues(date, strict, timezone);

			format = format.replace(/(Y{2}?Y{2})|M{2}|D{2}|h{2}|m{2}|s{2}|tz/g, function(){
				return valueMap[arguments[0] == 'MM' ? 'MM4SH' : arguments[0]];
			});

			return format;
		};

		/**
		 * 获取指定两个日期之间的天数
		 * @param  {Date} dateStart
		 * @param  {Date} dateEnd
		 * @return {int}
		 */
		this.getDaysBetweenDate = function(dateStart, dateEnd, timezone){
			timezone = timezone == null ? this._defaultTimezone : timezone;

			var 
				days 	= Math.floor((dateEnd - dateStart) / this._msperday),
				date 	= new Date(dateStart.getTime() + this._msperday * days),
				endValues	= this.getDateValues(dateEnd, false, timezone),
				dateValues 	= this.getDateValues(date, false, timezone);

			days += endValues['DD'] != dateValues['DD'] ? 1 : 0;

			return days;
		};

		/**
		 * 获取当月天数
		 * @return {[Number]} 当月天数
		 */
		this.getMonthDays = function(){
			var d= new Date();
			return new Date(d.getFullYear(), d.getMonth()+1,0).getDate();
		};


		/**
		 * 复制一个日期对象,支持Date对象和时间戳
		 * @param  {Date|int} date 
		 * @return {Date}      
		 */
		this.cloneDate = function(date){
			if(date == null || !date instanceof Date || !typeof date === 'number'){
				throw new Error('date is null or wrong object');
			}
			// 兼容日期格式
			if (typeof date === "string") {
				date = date.replace(/-/g, "/");
			}

			return new Date(date.getTime ? date.getTime() : date);
		};

		/**
		 * 获取某一时刻在指定时区内的日期值
		 * @param  {Date} date 时刻
		 * @param  {Boolean} strict 日期值是不是严格模式，延时模式时会补充每个值的位数
		 * @param  {int} timezone 时区
		 * @return {Object} map表, 包含键值YYYY, YY, MM, DD, hh, mm, ss, tz(时区)
		 */
		this.getDateValues = function(date, strict, timezone){
			date = this.cloneDate(date);

			strict = strict == null ? true : strict;
			timezone = timezone == null ? this._defaultTimezone : timezone;

			date.setTime(date.getTime() + (date.getTimezoneOffset() - timezone) * this._mspermin);

			var prefix = '00';

			return {
				'YYYY': date.getFullYear(),
				'YY': (prefix + date.getFullYear() % 100).slice(-2),
				'MM4SH': strict ? (prefix + (date.getMonth() + 1)).slice(-2) : (date.getMonth() + 1),
				'MM': strict ? (prefix + date.getMonth()).slice(-2) : date.getMonth(),
				'DD': strict ? (prefix + date.getDate()).slice(-2) : date.getDate(),
				'hh': strict ? (prefix + date.getHours()).slice(-2) : date.getHours(),
				'mm': strict ? (prefix + date.getMinutes()).slice(-2) : date.getMinutes(),
				'ss': strict ? (prefix + date.getSeconds()).slice(-2) : date.getSeconds(),
				'day': date.getDay(),
				'tz': (timezone > 0 ? '+' : '') + timezone / 60
			};
		};
		
		/**
		 * 获取某string的UTC DATE对象
		 * @param  {String} dateStr 日期字符串,默认是YYYY-MM-DD
		 */
		this.getUTCDateFromStr = function(dateStr){
			var date = this.getDateInStr(dateStr);
			return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 
					date.getHours(), date.getMinutes(), date.getSeconds());
		};

		this.convertUTCMsToLocalDate = function(ms) {
			var date = new Date(ms);
		    var newDate = new Date(ms);
		
		    var offset = date.getTimezoneOffset() / 60;
		    var hours = date.getHours();
		
		    newDate.setHours(hours + offset);
		
		    return newDate;   
		}


		/******************************************************************************************/
		/* 										简单例子										  */
		/******************************************************************************************/

		/*var testDate = this.getDateInStr('2013-08-30 16:13:43', 'YYYY-MM-DD hh:mm:ss');
		var testDate2 = this.getDate([2013, 0, 30, 16], 480);
		
		console.log(this.formatDate(testDate, 'YYYY/MM/DD hh:mm:ss tz', true, 480));
		console.log(this.formatDate(testDate2, 'YYYY/MM/DD hh:mm:ss tz', true, 480));

		console.log(this.getDateValues(this.getLastDateInMonth(testDate2, 480), true, 480));
		console.log(this.formatDate(this.getDateInNextMonth(testDate2, 480), 'YYYY/MM/DD hh:mm:ss tz', true, 0));*/
	};
});/*  |xGv00|0770f64a07bc9b1e7b20aed699906f7a */