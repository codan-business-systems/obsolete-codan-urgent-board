sap.ui.define([
	"sap/ui/core/UIComponent",
	"sap/ui/Device",
	"codan/zurgentboard/model/models",
	"codan/zurgentboard/model/polyfill/objectAssign",
	"codan/zurgentboard/model/polyfill/objectEntries",
	"codan/zurgentboard/model/polyfill/arrayFindIndex",
	"codan/zurgentboard/model/polyfill/arrayIncludes"
], function (UIComponent, Device, models) {
	"use strict";

	return UIComponent.extend("codan.zurgentboard.Component", {

		metadata: {
			manifest: "json",
			includes: ["css/style.css"]
		},

		/**
		 * The component is initialized by UI5 automatically during the startup of the app and calls the init method once.
		 * @public
		 * @override
		 */
		init: function () {
			// call the base component's init function
			UIComponent.prototype.init.apply(this, arguments);

			// enable routing
			this.getRouter().initialize();

			// set the device model
			this.setModel(models.createDeviceModel(), "device");
		}
	});
});