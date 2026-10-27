// Placeholder for the real catalog-driven rendering (category/product pages), Phase 3 of the build plan.

if (new URLSearchParams(window.location.search).get('reset') === '1') {
  localStorage.clear();
  window.location.href = 'index.html';
}

var CART_KEY = 'raja-cart';

function getCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
  catch (e) { return []; }
}

function setCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function addToCart(item) {
  var cart = getCart();
  var existing = cart.filter(function (l) { return l.sku === item.sku; })[0];
  if (existing) existing.qty += item.qty;
  else cart.push(item);
  setCart(cart);
  window.dispatchEvent(new CustomEvent('raja:addtocart', { detail: item }));
}

function syncCartCount() {
  var countEl = document.getElementById('cart-count');
  if (countEl) countEl.textContent = getCart().length;
}

syncCartCount();

(function () {
  var expandBtn = document.getElementById('variantsExpandBtn');
  if (!expandBtn) return;
  var table = document.querySelector('.variants-table');
  var label = expandBtn.querySelector('.variants-table__expand-label');
  expandBtn.addEventListener('click', function () {
    var expanded = table.classList.toggle('is-expanded');
    expandBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    label.textContent = expanded ? 'Réduire le tableau' : 'Voir les 8 références';
  });
})();

(function () {
  var toggles = document.querySelectorAll('.cart-line__breaks-toggle');
  toggles.forEach(function (toggle) {
    toggle.addEventListener('click', function () {
      toggle.closest('.cart-line').classList.toggle('is-expanded');
    });
  });
})();

(function () {
  var IDENTITY_KEY = 'raja-identified';
  var PERSONA_NAME = 'Jean-Christophe Tran';

  function setHeaderIdentified(identified) {
    var accountLabel = document.getElementById('account-label');
    var accountDot = document.getElementById('account-dot');
    var accountLink = document.getElementById('account-link');
    if (!accountLabel) return;
    accountLabel.textContent = identified ? PERSONA_NAME : 'Mon compte';
    if (accountDot) accountDot.hidden = !identified;
    if (accountLink) accountLink.href = identified ? 'userlogged.html' : 'login.html';
  }

  setHeaderIdentified(localStorage.getItem(IDENTITY_KEY) === '1');

  var form = document.getElementById('login-form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      localStorage.setItem(IDENTITY_KEY, '1');
      setHeaderIdentified(true);
      var emailInput = form.querySelector('input[type="email"]');
      var nameParts = PERSONA_NAME.split(' ');
      window.dispatchEvent(new CustomEvent('raja:identity', {
        detail: {
          email: emailInput ? emailInput.value : '',
          firstName: nameParts[0],
          lastName: nameParts.slice(1).join(' ')
        }
      }));
      var returnTo = new URLSearchParams(window.location.search).get('return');
      // Let the SDK send the identity event before the page unloads, otherwise the request is canceled
      setTimeout(function () {
        window.location.href = returnTo === 'cart' ? 'cart.html' : 'userlogged.html';
      }, 500);
    });
  }

  var logoutLink = document.getElementById('logout-link');
  if (logoutLink) {
    logoutLink.addEventListener('click', function (e) {
      e.preventDefault();
      localStorage.removeItem(IDENTITY_KEY);
      window.location.href = 'login.html';
    });
  }
})();

(function () {
  var tags = document.querySelectorAll('[data-personalized-tag]');
  if (!tags.length) return;
  var identified = localStorage.getItem('raja-identified') === '1';
  tags.forEach(function (tag) {
    var kind = tag.getAttribute('data-personalized-tag');
    if (kind === 'history' && identified) tag.hidden = false;
  });
})();

(function () {
  function delayedNav(selector) {
    document.querySelectorAll(selector).forEach(function (link) {
      link.addEventListener('click', function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        var href = link.href;
        setTimeout(function () {
          window.location.href = href;
        }, 100);
      });
    });
  }

  delayedNav('.product-tile__image-link');
  delayedNav('header .header-top__icons a[href="cart.html"]');
})();

(function () {
  var cartBtns = document.querySelectorAll('.variants-table__cart-btn');
  if (!cartBtns.length) return;

  var familyNameEl = document.querySelector('.product-title-row__title');
  var familyName = familyNameEl ? familyNameEl.textContent.trim() : '';
  var familyImgEl = document.querySelector('.product-gallery__img');
  var familyImg = familyImgEl ? familyImgEl.src : '';
  var CAS01A_IMG = 'https://raja.scene7.com/is/image/Raja/products/caisse-carton-brune-simple-cannelure-raja-10-x-10-x-10-cm_CAS01A.jpg?image=M_CAS01A_WEB_ACCESSORY_01$table$';

  cartBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var row = btn.closest('tr');
      var sku = row.querySelector('.variants-table__ref a').textContent.trim();
      var dims = row.children[1].textContent.trim();
      var packMin = parseInt(row.children[4].textContent.trim(), 10) || 1;
      var unitPrice = parseFloat(row.children[5].textContent.trim().replace(',', '.')) || 0;
      var qtyInput = row.querySelector('.variants-table__qty-input');
      var qty = parseInt(qtyInput.value, 10) || 0;
      if (qty <= 0) qty = packMin;

      addToCart({
        sku: sku,
        name: familyName + ' ' + dims + ' cm',
        unitPrice: unitPrice,
        unitLabel: 'la caisse',
        qty: qty,
        image: sku === 'CAS01A' ? CAS01A_IMG : familyImg
      });
      // Let the SDK send the Add To Cart event before the page unloads, otherwise the request is canceled
      setTimeout(function () { window.location.href = 'cart.html'; }, 500);
    });
  });
})();

(function () {
  var linesContainer = document.getElementById('cartLines');
  if (!linesContainer) return;

  var layout = document.getElementById('cartLayout');
  var emptyMsg = document.getElementById('cartEmpty');
  var guaranteeCheckbox = document.querySelector('.cart-recap__guarantee input');
  var shippingBanner = document.getElementById('cartShippingBanner');

  function currency(n) {
    return n.toFixed(2).replace('.', ',') + ' €';
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function updateQty(sku, qty) {
    var cart = getCart();
    if (qty <= 0) {
      cart = cart.filter(function (l) { return l.sku !== sku; });
    } else {
      cart.filter(function (l) { return l.sku === sku; }).forEach(function (l) { l.qty = qty; });
    }
    setCart(cart);
    render();
  }

  function renderLine(item) {
    var article = document.createElement('article');
    article.className = 'cart-line';
    article.dataset.sku = item.sku;
    article.innerHTML =
      '<div class="cart-line__top">' +
        '<a class="cart-line__thumb" href="product.html"><img src="' + item.image + '" alt="' + item.name + '" width="80" height="80"></a>' +
        '<div class="cart-line__desc">' +
          '<a class="cart-line__title" href="product.html">' + item.sku + '</a>' +
          '<p class="cart-line__name">' + item.name + '</p>' +
          '<p class="cart-line__stock"><span class="cart-line__stock-dot"></span>En stock - Livré en 24/48h</p>' +
          '<div class="cart-line__qty-row">' +
            '<div class="cart-line__qty">' +
              '<button type="button" class="cart-line__qty-btn" data-action="dec" aria-label="Diminuer la quantité">&minus;</button>' +
              '<input type="text" class="cart-line__qty-input" value="' + item.qty + '" inputmode="numeric">' +
              '<button type="button" class="cart-line__qty-btn" data-action="inc" aria-label="Augmenter la quantité">+</button>' +
            '</div>' +
            '<button type="button" class="cart-line__delete" aria-label="Supprimer l\'article">&#10005;</button>' +
          '</div>' +
        '</div>' +
        '<div class="cart-line__prices">' +
          '<div class="cart-line__price-row">' +
            '<span class="cart-line__price-label">Prix unitaire HT</span>' +
            '<span class="cart-line__price-unit">' + currency(item.unitPrice) + '</span>' +
            '<span class="cart-line__price-unit-note">' + item.unitLabel + '</span>' +
          '</div>' +
          '<div class="cart-line__price-row">' +
            '<span class="cart-line__price-label">Prix total HT</span>' +
            '<span class="cart-line__price-total">' + currency(item.qty * item.unitPrice) + '</span>' +
          '</div>' +
        '</div>' +
      '</div>';

    article.querySelector('[data-action="inc"]').addEventListener('click', function () {
      updateQty(item.sku, item.qty + 1);
    });
    article.querySelector('[data-action="dec"]').addEventListener('click', function () {
      updateQty(item.sku, item.qty - 1);
    });
    article.querySelector('.cart-line__delete').addEventListener('click', function () {
      updateQty(item.sku, 0);
    });
    article.querySelector('.cart-line__qty-input').addEventListener('change', function (e) {
      var val = parseInt(e.target.value, 10);
      updateQty(item.sku, isNaN(val) || val < 0 ? 0 : val);
    });
    return article;
  }

  function render() {
    var cart = getCart();
    linesContainer.innerHTML = '';
    syncCartCount();

    if (!cart.length) {
      if (layout) layout.hidden = true;
      if (emptyMsg) emptyMsg.hidden = false;
      return;
    }
    if (layout) layout.hidden = false;
    if (emptyMsg) emptyMsg.hidden = true;

    cart.forEach(function (item) {
      linesContainer.appendChild(renderLine(item));
    });

    var subtotal = cart.reduce(function (sum, l) { return sum + l.qty * l.unitPrice; }, 0);
    var freeShippingThreshold = 149;
    var shipping = subtotal >= freeShippingThreshold ? 0 : 12.90;
    var guarantee = guaranteeCheckbox && guaranteeCheckbox.checked ? 1.01 : 0;
    var totalHT = subtotal + shipping + guarantee;
    var tva = totalHT * 0.20;
    var totalTTC = totalHT + tva;

    if (shippingBanner) shippingBanner.hidden = shipping === 0;
    setText('cartShippingRemaining', currency(Math.max(0, freeShippingThreshold - subtotal)));
    setText('cartSubtotal', currency(subtotal));
    setText('cartShipping', shipping === 0 ? 'Gratuite' : currency(shipping));
    setText('cartGuarantee', currency(guarantee));
    setText('cartTotalHT', currency(totalHT));
    setText('cartTva', currency(tva));
    setText('cartTotalTTC', currency(totalTTC));
  }

  if (guaranteeCheckbox) guaranteeCheckbox.addEventListener('change', render);
  render();
})();

(function () {
  var checkoutBtn = document.getElementById('fastCheckoutBtn');
  if (!checkoutBtn) return;
  checkoutBtn.addEventListener('click', function () {
    if (localStorage.getItem('raja-identified') !== '1') {
      window.location.href = 'login.html?return=cart';
      return;
    }
    window.location.href = 'checkout.html';
  });
})();

(function () {
  var linesContainer = document.getElementById('checkoutLines');
  if (!linesContainer) return;

  var layout = document.getElementById('checkoutLayout');
  var emptyMsg = document.getElementById('checkoutEmpty');
  var confirmBtn = document.getElementById('checkoutConfirmBtn');
  var confirmMsg = document.getElementById('checkoutConfirmMsg');

  function currency(n) {
    return n.toFixed(2).replace('.', ',') + ' €';
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  var cart = getCart();
  if (!cart.length) {
    if (layout) layout.hidden = true;
    if (emptyMsg) emptyMsg.hidden = false;
    return;
  }

  cart.forEach(function (item) {
    var article = document.createElement('article');
    article.className = 'cart-line';
    article.innerHTML =
      '<div class="cart-line__top">' +
        '<span class="cart-line__thumb"><img src="' + item.image + '" alt="' + item.name + '" width="80" height="80"></span>' +
        '<div class="cart-line__desc">' +
          '<span class="cart-line__title">' + item.sku + '</span>' +
          '<p class="cart-line__name">' + item.name + '</p>' +
          '<p class="cart-line__stock"><span class="cart-line__stock-dot"></span>Quantité&nbsp;: ' + item.qty + '</p>' +
        '</div>' +
        '<div class="cart-line__prices">' +
          '<div class="cart-line__price-row">' +
            '<span class="cart-line__price-label">Prix unitaire HT</span>' +
            '<span class="cart-line__price-unit">' + currency(item.unitPrice) + '</span>' +
          '</div>' +
          '<div class="cart-line__price-row">' +
            '<span class="cart-line__price-label">Prix total HT</span>' +
            '<span class="cart-line__price-total">' + currency(item.qty * item.unitPrice) + '</span>' +
          '</div>' +
        '</div>' +
      '</div>';
    linesContainer.appendChild(article);
  });

  var subtotal = cart.reduce(function (sum, l) { return sum + l.qty * l.unitPrice; }, 0);
  var shipping = subtotal >= 149 ? 0 : 12.90;
  var totalHT = subtotal + shipping;
  var tva = totalHT * 0.20;
  var totalTTC = totalHT + tva;

  setText('checkoutSubtotal', currency(subtotal));
  setText('checkoutShipping', shipping === 0 ? 'Gratuite' : currency(shipping));
  setText('checkoutTotalHT', currency(totalHT));
  setText('checkoutTva', currency(tva));
  setText('checkoutTotalTTC', currency(totalTTC));

  var orderId = 'RAJA-' + Date.now();
  if (confirmBtn) confirmBtn.dataset.orderId = orderId;

  if (confirmBtn) {
    confirmBtn.addEventListener('click', function () {
      window.dispatchEvent(new CustomEvent('raja:checkout', {
        detail: { orderId: orderId, items: cart, totalHT: totalHT }
      }));
      setCart([]);
      syncCartCount();
      if (layout) layout.hidden = true;
      if (confirmMsg) confirmMsg.hidden = false;
    });
  }
})();

(function () {
  var tabs = document.querySelectorAll('.product-tabs__tab');
  if (!tabs.length) return;
  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      var target = tab.getAttribute('data-tab');
      document.querySelectorAll('.product-tabs__tab').forEach(function (t) {
        t.classList.toggle('is-active', t === tab);
      });
      document.querySelectorAll('.product-tabs__panel').forEach(function (p) {
        p.classList.toggle('is-active', p.getAttribute('data-tab-panel') === target);
      });
    });
  });
})();
