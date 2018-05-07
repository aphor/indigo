(function(exports) {
  "use strict";

  if (!exports.Indigo) exports.Indigo = {};
  Indigo = exports.Indigo;

  // Handle the rendering of the document title, and the browser window title
  Indigo.DocumentTitleView = Backbone.View.extend({
    el: '.workspace-header',
    breadcrumbTemplate: '#breadcrumb-template',

    initialize: function() {
      this.breadcrumbTemplate = Handlebars.compile($(this.breadcrumbTemplate).html());
      this.expressions = this.model.work.documents();

      this.listenTo(this.model, 'change:title change:expression_date change:draft sync change:frbr_uri', this.render);
      this.listenTo(this.expressions, 'sync change', this.render);
    },

    getTitle: function() {
      return this.model.get('title') + ' @ ' + this.model.get('expression_date');
    },

    render: function(title) {
      var html = this.getTitle();

      document.title = html;

      // breadcrumb
      var country = Indigo.countries[this.model.get('country')],
          locality = this.model.get('locality'),
          dates = this.model.work.expressionDates(),
          docs = this.expressions,
          current_id = this.model.get('id');
      locality = locality ? country.localities[locality] : null;
      dates.reverse();

      var expressions = _.map(dates, function(date) {
        return {
          date: date,
          documents: _.map(docs.where({expression_date: date}), function(d) {
            d = d.toJSON();
            d.current = current_id == d.id;
            return d;
          })
        };
      });

      this.$('.breadcrumb').html(this.breadcrumbTemplate({
        document: this.model.toJSON(),
        country: country,
        locality: locality,
        work: this.model.work.toJSON(),
        expressions: expressions,
      }));
    },
  });

  // The DocumentView is the primary view on the document detail page.
  // It is responsible for managing the other views and allowing the user to
  // save their changes. It has nested sub views that handle separate portions
  // of the larger view page.
  //
  //   DocumentTitleView - handles rendering the title of the document when it changes,
  //                       including updating the browser page title
  //
  //   DocumentPropertiesView - handles editing the document metadata, such as
  //                            publication dates and URIs
  //
  //   DocumentAttachmentsView - handles managing document attachments
  //
  //   DocumentRepealView - handles setting a document as repealed
  //
  //   DocumentEditorView - handles editing the document's body content
  //
  //   DocumentRevisionsView - handles walking through revisions to a document
  //
  // When saving a document, the DocumentView tells the children to save their changes.
  // In turn, they trigger 'dirty' and 'clean' events when their models change or
  // once they've been saved. The DocumentView uses those signals to enable/disable
  // the save button.
  //
  //
  Indigo.DocumentView = Backbone.View.extend({
    el: 'body',
    events: {
      'click .menu .dropdown-submenu > a': 'stopMenuClick',
      'click .workspace-buttons .btn.save': 'save',
      'click .workspace-buttons .save-and-publish': 'saveAndPublish',
      'click .workspace-buttons .save-and-unpublish': 'saveAndUnpublish',
      'click .menu .save': 'save',
      'click .menu .delete-document': 'delete',
      'click .menu .clone-document': 'clone',
      'click .menu .change-document-work': 'changeWork',
      'hidden.bs.tab a[href="#content-tab"]': 'tocDeselected',
      'shown.bs.tab a[href="#preview-tab"]': 'renderPreview',
    },

    initialize: function() {
      var library = Indigo.library,
          document_id = $('.workspace[data-document-id]').data('document-id') || null,
          self = this;

      this.$saveBtn = $('.workspace-buttons .btn.save');
      this.$menu = $('.workspace-header .menu');
      this.dirty = false;

      // stop disable menus
      $('.menu').on('click', '.disabled a', _.bind(this.stopMenuClick));

      // get it from the library
      this.document = Indigo.library.get(document_id);
      this.document.work = new Indigo.Work(Indigo.Preloads.work);

      this.document.on('change', this.setDirty, this);
      this.document.on('change:draft', this.draftChanged, this);

      this.documentContent = new Indigo.DocumentContent({document: this.document});
      this.documentContent.on('change', this.setDirty, this);
      
      this.previewDirty = true;

      this.titleView = new Indigo.DocumentTitleView({model: this.document});
      this.propertiesView = new Indigo.DocumentPropertiesView({model: this.document});
      this.propertiesView.on('dirty', this.setDirty, this);
      this.propertiesView.on('clean', this.setClean, this);

      this.attachmentsView = new Indigo.DocumentAttachmentsView({document: this.document});
      this.attachmentsView.on('dirty', this.setDirty, this);
      this.attachmentsView.on('clean', this.setClean, this);
      this.document.attachments().on('add remove reset', function() {
        // update attachment count in nav tabs
        var count = self.document.attachments().length;
        $('.document-sidebar .nav .attachment-count').text(count === 0 ? '' : count);
      });

      this.definedTermsView = new Indigo.DocumentDefinedTermsView({model: this.documentContent});
      this.referencesView = new Indigo.DocumentReferencesView({model: this.documentContent});
      this.revisionsView = new Indigo.DocumentRevisionsView({document: this.document, documentContent: this.documentContent});

      this.tocView = new Indigo.DocumentTOCView({model: this.documentContent});
      this.tocView.on('item-selected', this.showEditor, this);

      this.bodyEditorView = new Indigo.DocumentEditorView({
        model: this.document,
        documentContent: this.documentContent,
        tocView: this.tocView,
      });
      this.bodyEditorView.on('dirty', this.setDirty, this);
      this.bodyEditorView.on('clean', this.setClean, this);

      this.annotationsView = new Indigo.DocumentAnnotationsView({model: this.document});
      this.annotationsView.listenTo(this.bodyEditorView.sourceEditor, 'rendered', this.annotationsView.renderAnnotations);

      this.activityView = new Indigo.DocumentActivityView({document: this.document});

      // prevent the user from navigating away without saving changes
      $(window).on('beforeunload', _.bind(this.windowUnloading, this));

      // pretend we've fetched it, this sets up additional handlers
      this.document.trigger('sync');

      // preload content
      this.documentContent.set('content', Indigo.Preloads.documentContent);

      // pretend this document is unchanged
      this.documentContent.trigger('sync');

      // make menu peers behave like real menus on hover
      $('.menu .btn-link').on('mouseover', function(e) {
        var $menuItem = $(this),
            $parent = $menuItem.parent();
            
        if (!$parent.hasClass("open") && $parent.siblings(".open").length) {
          $menuItem.click();
        }
      });
    },

    windowUnloading: function(e) {
      if (this.propertiesView.dirty || this.bodyEditorView.dirty || this.bodyEditorView.editing) {
        e.preventDefault();
        return 'You will lose your changes!';
      }
    },

    showEditor: function(item) {
      if (item) {
        this.$el.find('a[href="#content-tab"]').click();
      }
    },

    setDirty: function() {
      // our preview is now dirty
      this.previewDirty = true;

      if (!this.dirty) {
        this.dirty = true;
        this.$saveBtn
          .removeClass('btn-default')
          .prop('disabled', false);
        this.$menu.find('.save').removeClass('disabled');
      }
    },

    setClean: function() {
      // disable the save button if all views are clean
      if (!this.propertiesView.dirty && !this.bodyEditorView.dirty && !this.attachmentsView.dirty) {
        this.dirty = false;
        this.$saveBtn
          .prop('disabled', true)
          .find('.fa')
            .removeClass('fa-pulse fa-spinner')
            .addClass('fa-save');
        this.$menu.find('.save').addClass('disabled');
      }
    },

    draftChanged: function() {
      var draft = this.document.get('draft');

      this.$('.workspace')
        .toggleClass('is-draft', draft)
        .toggleClass('is-published', !draft);

      this.$menu.find('.delete-document').toggleClass('disabled', !draft);
    },

    saveAndPublish: function() {
      if (Indigo.user.hasPerm('indigo_api.publish_document') && confirm('Publish this document to users?')) {
        this.document.set('draft', false);
        this.save();
      }
    },

    saveAndUnpublish: function() {
      if (Indigo.user.hasPerm('indigo_api.publish_document') && confirm('Hide this document from users?')) {
        this.document.set('draft', true);
        this.save();
      }
    },

    save: function() {
      var self = this;
      var deferred = null;

      // always save properties if we save content
      this.propertiesView.dirty = this.propertiesView.dirty || this.bodyEditorView.dirty;

      var fail = function() {
        self.$saveBtn
          .prop('disabled', false)
          .find('.fa')
            .removeClass('fa-pulse fa-spinner')
            .addClass('fa-save');
        self.$menu.find('.save').removeClass('disabled');
      };

      this.$saveBtn
        .prop('disabled', true)
        .find('.fa')
          .removeClass('fa-save')
          .addClass('fa-pulse fa-spinner');
      this.$menu.find('.save').addClass('disabled');

      deferred = $.Deferred().resolve();

      // We save the content first, and then save
      // the properties on top of it, so that content
      // properties that change metadata in the content
      // take precendence.
      deferred.then(function() {
        self.bodyEditorView.save().then(function() {
          self.propertiesView.save().then(function() {
            self.attachmentsView.save().fail(fail);
          }).fail(fail);
        }).fail(fail);
      }).fail(fail);
    },

    renderPreview: function() {
      if (this.previewDirty) {
        var self = this,
            data = this.document.toJSON();

        data.content = this.documentContent.toXml();
        data = JSON.stringify({'document': data});

        $.ajax({
          url: '/api/render',
          type: "POST",
          data: data,
          contentType: "application/json; charset=utf-8",
          dataType: "json"})
          .then(function(response) {
            $('#preview-tab .akoma-ntoso').html(response.output);
            self.previewDirty = false;
          });
      }
    },

    tocDeselected: function(e) {
      this.tocView.trigger('deselect');
    },

    delete: function() {
      if (!this.document.get('draft')) {
        alert('You cannot delete published documents. Please mark the document as a draft and try again.');
        return;
      }

      if (confirm('Are you sure you want to delete this document?')) {
        Indigo.progressView.peg();
        this.document
          .destroy()
          .then(function() {
            document.location = '/library';
          });
      }
    },

    clone: function() {
      if (confirm('Go ahead and create a copy of this document?')) {
        var clone = this.document.clone();
        clone.set({
          draft: true,
          id: null,
          content: this.documentContent.get('content'),
        });

        Indigo.progressView.peg();
        clone.save().then(function(doc) {
          document.location = '/documents/' + doc.id + '/';
        });
      }
    },

    changeWork: function(e) {
      if (!confirm("Are you sure you want to change the work this document is linked to?")) return;

      var document = this.document;
      var chooser = new Indigo.WorkChooserView({});

      chooser.setFilters({country: document.get('country')});
      chooser.choose(document.work);
      chooser.showModal().done(function(chosen) {
        if (chosen) {
          document.setWork(chosen);
        }
      });
    },

    stopMenuClick: function(e) {
      // stop menu clicks on disabled items from doing anything
      e.preventDefault();
      e.stopImmediatePropagation();
    },
  });
})(window);
