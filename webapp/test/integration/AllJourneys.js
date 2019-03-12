/* global QUnit*/

sap.ui.define([
	"sap/ui/test/Opa5",
	"codan/zurgentboard/test/integration/pages/Common",
	"sap/ui/test/opaQunit",
	"codan/zurgentboard/test/integration/pages/Main",
	"codan/zurgentboard/test/integration/navigationJourney"
], function (Opa5, Common) {
	"use strict";
	Opa5.extendConfig({
		arrangements: new Common(),
		viewNamespace: "codan.zurgentboard.view.",
		autoWait: true
	});
});