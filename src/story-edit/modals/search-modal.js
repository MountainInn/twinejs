'use strict';
const $ = require('jquery');
const _ = require('underscore');
const Backbone = require('backbone');
const Marionette = require('backbone.marionette');
const locale = require('../../locale');
const notify = require('../../ui/notify');
const resultTemplate = require('../ejs/search-modal-result.ejs');

require('../../ui/collapse');

module.exports = Backbone.View.extend({
	initialize(options) {
		this.parent = options.parent;
		this.resultTemplate = resultTemplate;
	},

	/**
	 Opens a modal dialog for search/replace.

	 @method open
	**/

	open() {
		this.$el.data('modal').trigger('show');
	},

	/**
	 Closes the modal dialog for search/replace.

	 @method close
	**/

	close() {
		this.$el.data('modal').trigger('hide');
	},

	/**
	 Performs a search in story passages, updating the results list.

	 @method updateResults
	**/

	updateResults() {
		const searchTerm = this.searchRegexp();
		const searchNames = this.$('#searchNames').prop('checked');

		if (searchTerm.source === '') {
			// bug out early if there was no text entered

			this.$('.results').empty();
			this.$('.resultSummary').hide();
			return;
		}

		let passagesMatched = 0;
		let resultHtml = '';

		this.$('.loading').show();

		this.parent.children.each(function(view) {
			const numMatches = view.model.numMatches(searchTerm, searchNames);

			if (numMatches !== 0) {
				passagesMatched++;

				let name = _.escape(view.model.get('name'));

				if (searchNames) {
					name = name.replace(
						searchTerm,
						'<span class="highlight">$1</span>'
					);
				}

				// we have to do a bit of a song and dance
				// to escape things correctly for the preview

				let preview = _.escape(
					view.model.get('text').replace(
						searchTerm,
						'\u3000$1\u3001'
					)
				);

				preview = preview.replace(
					/\u3000/g,
					'<span class="highlight">'
				);
				preview = preview.replace(/\u3001/g, '</span>', 'g');

				resultHtml += Marionette.Renderer.render(this.resultTemplate, {
					passageId: view.model.cid,
					passageName: name,
					numMatches,
					resultNumber: passagesMatched,
					searchPreview: preview
				});
			};
		}.bind(this));

		this.$('.loading').hide();

		if (resultHtml !== '') {
			// L10n: Matched in the sense of matching a search criteria. %d is
			// the number of passages.
			this.$('.matches').text(
				locale.sayPlural(
					'%d passage matches.',
					'%d passages match.',
					passagesMatched
				)
			);
			this.$('.resultSummary').show();
			this.$('.results').html(resultHtml);
		}
		else {
			this.$('.resultSummary').hide();
			this.$('.results').html(
				'<p>' + locale.say('No matching passages found.') + '</p>'
			);
		}
	},

	/**
	 Shows all result excerpts.

	 @method showAllResults
	**/

	showAllResults() {
		this.$('.results').find('.collapseContainer').each(function() {
			$(this).collapse('show');
		});
	},

	/**
	 Hides all result excerpts.

	 @method hideAllResults
	**/

	hideAllResults() {
		this.$('.results').find('.collapseContainer').each(function() {
			$(this).collapse('hide');
		});
	},

	/**
	 Performs a replace in a particular passage result, then
	 hides it from the search results.

	 @method replaceInPassage
	 @param {Event} e event object
	**/

	replaceInPassage(e) {
		const container = $(e.target).closest('.result');
		const model = this.parent.children.findByModelCid(
			container.attr('data-passage')
		).model;

		model.replace(
			this.searchRegexp(),
			this.$('#replaceWith').val(),
			this.$('#searchNames').prop('checked')
		);
		container.slideUp(null, () => { container.remove(); });
	},

	/**
	 Performs a replace in all passages, closes the modal,
	 then shows a notification as to how many replacements were made.

	 @method replaceAll
	**/

	replaceAll() {
		let passagesMatched = 0;
		let totalMatches = 0;
		const searchTerm = this.searchRegexp();
		const replaceWith = this.$('#replaceWith').val();
		// FIXME
		// var inNames = this.$('#searchNames').prop('checked');

		this.parent.children.each(function(view) {
			const numMatches = view.model.numMatches(searchTerm);

			if (numMatches !== 0) {
				passagesMatched++;
				totalMatches += numMatches;
				view.model.replace(
					searchTerm,
					replaceWith,
					this.$('#searchNames').prop('checked')
				);
			}
		}.bind(this));

		this.$el.one('modalhide', () => {
			// L10n: replacement in the sense of text search and replace. %d is
			// the number.
			const replacementDesc = locale.sayPlural(
				'%d replacement was made in',
				'%d replacements were made in', totalMatches
			);

			// L10n: %d is a number of passages.
			const passageDesc = locale.sayPlural(
				'%d passage',
				'%d passages',
				passagesMatched
			);

			// L10n: This is the formatting used to combine two pluralizations.
			// In English, %1$s equals "2 replacements were made in" and
			// %2$s equals "5 passages." This is a way to reshape the
			// sentence as needed.
			notify(locale.say('%1$s %2$s', replacementDesc, passageDesc));
		});

		this.close();
	},

	/**
	 Creates a RegExp object to match the entered text and checkboxes selected.

	 @method searchRegexp
	 @return {RegExp} the resulting regular expression
	**/

	searchRegexp() {
		let flags = 'g';

		if (!this.$('#searchCaseSensitive').prop('checked')) {
			flags += 'i';
		}

		let source = this.$('#searchFor').val();

		if (this.$('#searchRegexp').prop('checked')) {
			source = source.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
		}

		return new RegExp('(' + source + ')', flags);
	},

	/**
	 Syncs the contents of the search field with the quick find field.

	 @method syncSearch
	**/

	syncSearch() {
		this.$('.results').empty();
		this.$('.resultSummary').hide();
		this.$('#searchFor').val($('#storyEditView .searchField').val());
	},

	events: {
		'modalshow': 'syncSearch',
		'keyup #searchFor': 'updateResults',
		'change #searchNames': 'updateResults',
		'change #searchCaseSensitive': 'updateResults',
		'change #searchRegexp': 'updateResults',
		'click .expandAll': 'showAllResults',
		'click .collapseAll': 'hideAllResults',
		'click .replacePassage': 'replaceInPassage',
		'click .replaceAll': 'replaceAll'
	}
});
