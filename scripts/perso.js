// Salesforce Interactions Web SDK — explicit Personalization.fetch for the reco and banner zones.
// PP names below are the Personalization Point API names in the RAJA org.

(function () {
  var PP_NAMES = {
    pdpSimilar: 'PDP_Similar_Products',
    pdpBought: 'PDP_Customers_Also_Bought',
    cartFbt: 'Cart_Frequently_Bought_Together',
    homePromo: 'Home_Promo_Strip',
    homeHero: 'Home_Hero_Banner',
    homeReco: 'Home_Recommended_For_You_V3',
    homeSuggestions: 'PDP_Customers_Also_Viewed'
  };

  function waitForPersonalization(callback) {
    var start = Date.now();
    (function poll() {
      if (window.SalesforceInteractions && window.SalesforceInteractions.Personalization && window.SalesforceInteractions.Personalization.fetch) {
        callback();
        return;
      }
      if (Date.now() - start > 8000) return;
      setTimeout(poll, 250);
    })();
  }

  function findDecision(result, ppName) {
    var list = (result && result.personalizations) || [];
    return list.filter(function (p) { return p.personalizationPointName === ppName; })[0];
  }

  function dispatchDecision(zone, decision) {
    window.dispatchEvent(new CustomEvent('raja-sp:decision', { detail: { zone: zone, decision: decision } }));
    console.log('[raja-sp] decision for zone "' + zone + '":', decision);
  }

  var LOCALE = localStorage.getItem('raja-locale') || 'fr_FR';

  // The button shows the other language; switching reloads so every zone renders in the new locale.
  var langSwitch = document.getElementById('lang-switch');
  if (langSwitch) {
    langSwitch.textContent = LOCALE === 'en_GB' ? 'FR' : 'EN';
    langSwitch.addEventListener('click', function () {
      localStorage.setItem('raja-locale', LOCALE === 'en_GB' ? 'fr_FR' : 'en_GB');
      location.reload();
    });
  }

  // SP returns every Product_Localization row: use the site locale's row, else the root fields.
  function localized(product) {
    var rows = product.Product_Localization__dlm || [];
    var row = rows.filter(function (r) { return r.Locale__c === LOCALE; })[0];
    if (!row) {
      return { name: product.ssot__Name__c, price: product.ssot__MSRPAmount__c, currency: 'EUR' };
    }
    return {
      name: row.ssot_Name__c,
      price: row.ssot_MSRPAmount__c,
      currency: row.ssot_MSRPAmountCurrency__c
    };
  }

  function formatPrice(amount, currency) {
    if (currency === 'GBP') return '£' + Number(amount).toFixed(2);
    return Number(amount).toFixed(2).replace('.', ',') + ' €';
  }

  // Links use the variant SKU: the sitemap maps it back to the same PR-xxx catalog id.
  function productCard(product) {
    var href = 'product.html?sku=' + encodeURIComponent(product.ssot__ProductSKU__c);
    var card = document.createElement('article');
    card.className = 'reco-slider__card';
    card.innerHTML =
      '<img class="reco-slider__brand" src="assets/img/raja-brand-badge.png" width="24" height="24" alt="RAJA">' +
      '<div class="reco-slider__body">' +
        '<a><img class="reco-slider__img"></a>' +
        '<div class="reco-slider__info">' +
          '<a class="reco-slider__name"></a>' +
          '<p class="reco-slider__from">À partir de</p>' +
          '<p class="reco-slider__price"><strong></strong><span class="ht">HT</span></p>' +
        '</div>' +
      '</div>';
    var links = card.querySelectorAll('a');
    links[0].href = href;
    links[1].href = href;
    var loc = localized(product);
    links[1].textContent = loc.name;
    var image = card.querySelector('.reco-slider__img');
    image.src = product.ssot__PrimaryProductImageURL__c;
    image.alt = loc.name;
    card.querySelector('.reco-slider__price strong').textContent = formatPrice(loc.price, loc.currency);
    return card;
  }

  // An empty decision keeps the static cards and title in place.
  function renderRecoZone(zone, decision) {
    var products = (decision && decision.data) || [];
    if (!products.length) return;
    var section = document.querySelector('[data-zone="' + zone + '"]');
    var track = section.querySelector('.reco-slider__track');
    var attributes = decision.attributes || {};
    var title = (LOCALE === 'en_GB' && attributes.IntroductionTextEN) || attributes.IntroductionText;
    if (title) {
      section.querySelector('.reco-slider__title').textContent = title;
    }
    track.innerHTML = '';
    products.forEach(function (product) { track.appendChild(productCard(product)); });
  }

  // No anchorId passed: the SDK anchors on the product of the last View Catalog Object event,
  // so the fetch must wait for the sitemap to send it. window.rajaCatalogViewSent is set by the
  // inline <head> listener in product.html when the event fired before this script ran.
  function onCatalogObjectView(callback) {
    if (window.rajaCatalogViewSent) {
      callback();
      return;
    }
    document.addEventListener('interactions:onEventSend', function handler(event) {
      var action = event.detail && event.detail.actionEvent;
      var interaction = action && action.interaction;
      if (!interaction || interaction.name !== 'View Catalog Object') return;
      document.removeEventListener('interactions:onEventSend', handler);
      callback();
    });
  }

  function fetchPdpZones() {
    var names = [PP_NAMES.pdpSimilar, PP_NAMES.pdpBought];
    window.SalesforceInteractions.Personalization.fetch(names).then(function (result) {
      var similarDecision = findDecision(result, PP_NAMES.pdpSimilar);
      var boughtDecision = findDecision(result, PP_NAMES.pdpBought);
      // Manual cross-zone dedup: the platform does not dedupe between two Personalization Points,
      // so products already shown in the similar zone are dropped from the bought zone. The bought PP
      // returns 8 so that 4 remain after the dedup.
      var shownIds = ((similarDecision && similarDecision.data) || []).map(function (p) { return p.ssot__Id__c; });
      if (boughtDecision && boughtDecision.data) {
        boughtDecision.data = boughtDecision.data.filter(function (p) {
          return shownIds.indexOf(p.ssot__Id__c) === -1;
        }).slice(0, 4);
      }
      dispatchDecision('pdp-reco-consulted', similarDecision);
      dispatchDecision('pdp-reco-bought', boughtDecision);
      renderRecoZone('pdp-reco-consulted', similarDecision);
      renderRecoZone('pdp-reco-bought', boughtDecision);
    });
  }

  // The sitemap's CATALOG_IDS lives in the org connector, out of reach here. Only product.html
  // adds to cart, and it lists these 8 variants.
  var CART_CATALOG_IDS = {
    CAS01A: 'PR-001-01', CAS15: 'PR-001-02', CAS15H: 'PR-001-03', CAS25: 'PR-001-04',
    CAS28A: 'PR-001-05', CAS22D: 'PR-001-06', CAS43: 'PR-001-07', CAS79: 'PR-001-08'
  };
  var CART_RECO_COUNT = 4;

  function cartCatalogIds() {
    var cart;
    try { cart = JSON.parse(localStorage.getItem('raja-cart')) || []; }
    catch (e) { cart = []; }
    return cart.map(function (line) { return CART_CATALOG_IDS[line.sku]; }).filter(Boolean);
  }

  // Round-robin over the per-item lists (1st of each, then 2nd...) so every cart item is represented,
  // skipping duplicates and products already in the cart.
  function mergeCartDecisions(decisions, excludedIds) {
    var seen = excludedIds.slice();
    var merged = [];
    var lists = decisions.map(function (d) { return (d && d.data) || []; });
    var longest = Math.max.apply(null, lists.map(function (l) { return l.length; }));
    for (var rank = 0; rank < longest && merged.length < CART_RECO_COUNT; rank++) {
      lists.forEach(function (list) {
        var product = list[rank];
        if (!product || merged.length >= CART_RECO_COUNT || seen.indexOf(product.ssot__Id__c) !== -1) return;
        seen.push(product.ssot__Id__c);
        merged.push(product);
      });
    }
    var first = decisions.filter(Boolean)[0];
    return { attributes: first && first.attributes, data: merged };
  }

  // The cart page sends no View Catalog Object, so each cart item is passed explicitly as anchor
  // (the SDK accepts a single anchorId per fetch).
  function fetchCartZones() {
    if (!document.querySelector('[data-zone="cart-reco-fbt"]')) return;
    var anchorIds = cartCatalogIds();
    if (!anchorIds.length) return;
    var fetches = anchorIds.map(function (anchorId) {
      return window.SalesforceInteractions.Personalization.fetch([PP_NAMES.cartFbt], { anchorId: anchorId })
        .then(function (result) { return findDecision(result, PP_NAMES.cartFbt); });
    });
    Promise.all(fetches).then(function (decisions) {
      var merged = mergeCartDecisions(decisions, anchorIds);
      dispatchDecision('cart-reco-fbt', merged);
      renderRecoZone('cart-reco-fbt', merged);
    });
  }

  // No decision returned (no matching affinity) keeps the static #hero visible.
  function renderHomeHero(decision) {
    var attrs = decision && decision.attributes;
    if (!attrs || !attrs.Headline) return;
    var section = document.getElementById('hero-returning');
    var image = section.querySelector('.hero-returning__image');
    section.querySelector('.hero-returning__banner').href = attrs.CTA_URL || '#';
    section.querySelector('.hero-returning__headline').textContent = attrs.Headline;
    section.querySelector('.hero-returning__subheadline').textContent = attrs.Subheadline || '';
    section.querySelector('.hero-returning__cta').textContent = (attrs.CTA_Label || '') + ' ›';
    if (attrs.Image_URL) {
      image.src = attrs.Image_URL;
      image.hidden = false;
    }
    document.getElementById('hero').hidden = true;
    section.hidden = false;
  }

  // No decision returned (unknown visitor) keeps the static 250 € strip.
  function renderPromoStrip(decision) {
    var attrs = decision && decision.attributes;
    if (!attrs || !attrs.Headline) return;
    var strip = document.querySelector('.promo-strip');
    var headline = document.createElement('strong');
    headline.textContent = attrs.Headline;
    strip.querySelector('.promo-strip__msg').replaceChildren(headline, ' ' + (attrs.Subheadline || ''));
    var cta = strip.querySelector('.promo-strip__cta');
    cta.href = attrs.CTA_URL || '#';
    cta.textContent = attrs.CTA_Label || '';
    if (attrs.Image_URL) strip.querySelector('.promo-strip__logo').src = attrs.Image_URL;
  }

  // The home page sends no View Catalog Object: the suggestions zone anchors on the last product
  // viewed (stored by product.html). Without one, no fetch and the static cards stay.
  function fetchHomeSuggestions() {
    var anchorId = localStorage.getItem('raja-last-viewed');
    if (!anchorId) return Promise.resolve(undefined);
    return window.SalesforceInteractions.Personalization.fetch([PP_NAMES.homeSuggestions], { anchorId: anchorId })
      .then(function (result) { return findDecision(result, PP_NAMES.homeSuggestions); });
  }

  function fetchHomeZones() {
    if (!document.getElementById('hero-returning')) return;
    var names = [PP_NAMES.homePromo, PP_NAMES.homeHero, PP_NAMES.homeReco];
    Promise.all([
      window.SalesforceInteractions.Personalization.fetch(names, { locale: LOCALE }),
      fetchHomeSuggestions()
    ]).then(function (results) {
      var promoDecision = findDecision(results[0], PP_NAMES.homePromo);
      var heroDecision = findDecision(results[0], PP_NAMES.homeHero);
      var recoDecision = findDecision(results[0], PP_NAMES.homeReco);
      var suggestionsDecision = results[1];
      // Same manual cross-zone dedup as the PDP: suggestions already shown in the reco zone are dropped.
      var shownIds = ((recoDecision && recoDecision.data) || []).map(function (p) { return p.ssot__Id__c; });
      if (suggestionsDecision && suggestionsDecision.data) {
        suggestionsDecision.data = suggestionsDecision.data.filter(function (p) {
          return shownIds.indexOf(p.ssot__Id__c) === -1;
        });
      }
      dispatchDecision('home-promo', promoDecision);
      dispatchDecision('home-hero', heroDecision);
      dispatchDecision('home-reco-potions', recoDecision);
      dispatchDecision('home-reco-potions-2', suggestionsDecision);
      renderPromoStrip(promoDecision);
      renderHomeHero(heroDecision);
      renderRecoZone('home-reco-potions', recoDecision);
      renderRecoZone('home-reco-potions-2', suggestionsDecision);
    });
  }

  if (document.querySelector('[data-zone="pdp-reco-consulted"]')) onCatalogObjectView(fetchPdpZones);

  waitForPersonalization(function () {
    fetchCartZones();
    fetchHomeZones();
  });
})();
