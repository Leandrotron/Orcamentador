(function (global) {
  'use strict';

  var API_ROOT = 'https://api.github.com';

  function PublisherError(message, status, code, details) {
    this.name = 'TariffPublisherError';
    this.message = message;
    this.status = status || 0;
    this.code = code || 'UNKNOWN';
    this.details = details || '';
    if (Error.captureStackTrace) Error.captureStackTrace(this, PublisherError);
  }
  PublisherError.prototype = Object.create(Error.prototype);
  PublisherError.prototype.constructor = PublisherError;

  function requireText(value, label) {
    var text = String(value == null ? '' : value).trim();
    if (!text) throw new PublisherError(label + ' não informado.', 0, 'INVALID_ARGUMENT');
    return text;
  }

  function apiUrl(owner, repo, suffix) {
    return API_ROOT + '/repos/' + encodeURIComponent(owner) + '/' + encodeURIComponent(repo) + suffix;
  }

  async function requestJson(url, options) {
    var response;
    try {
      response = await global.fetch(url, options);
    } catch (error) {
      throw new PublisherError('Não foi possível acessar o GitHub. Nenhum dado oficial foi alterado.', 0, 'NETWORK', error && error.message);
    }

    var text = await response.text();
    var data = null;
    if (text) {
      try { data = JSON.parse(text); }
      catch (error) {
        throw new PublisherError('O GitHub retornou uma resposta inválida.', response.status, 'INVALID_RESPONSE');
      }
    }
    if (!response.ok) throwGithubError(response.status, data);
    if (data == null) throw new PublisherError('O GitHub retornou uma resposta vazia.', response.status, 'INVALID_RESPONSE');
    return data;
  }

  function throwGithubError(status, data) {
    var apiMessage = data && typeof data.message === 'string' ? data.message : '';
    if (status === 401) throw new PublisherError('Token inválido, expirado ou revogado.', status, 'UNAUTHORIZED');
    if (status === 403) {
      var limited = /rate limit/i.test(apiMessage);
      throw new PublisherError(limited ? 'Limite de requisições da API do GitHub atingido.' : 'O token não possui permissão de escrita no repositório.', status, limited ? 'RATE_LIMIT' : 'FORBIDDEN');
    }
    if (status === 409) throw new PublisherError('O arquivo foi alterado por outra operação. Analise novamente e tente publicar.', status, 'CONFLICT');
    if (status === 422) throw new PublisherError('O GitHub rejeitou os dados enviados.', status, 'UNPROCESSABLE');
    if (status === 404) throw new PublisherError('Recurso não encontrado ou inacessível no GitHub.', status, 'NOT_FOUND');
    throw new PublisherError(apiMessage || 'Falha na API do GitHub.', status, 'GITHUB_ERROR');
  }

  function headers(token, includeContentType) {
    var result = {
      'Authorization': 'Bearer ' + requireText(token, 'Token'),
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
    if (includeContentType) result['Content-Type'] = 'application/json';
    return result;
  }

  async function getFile(options) {
    options = options || {};
    var token = requireText(options.token, 'Token');
    var owner = requireText(options.owner, 'Owner');
    var repo = requireText(options.repo, 'Repositório');
    var branch = requireText(options.branch, 'Branch');
    var ref = requireText(options.ref || branch, 'Referência');
    var path = requireText(options.path, 'Caminho');
    var url = apiUrl(owner, repo, '/contents/' + path.split('/').map(encodeURIComponent).join('/') + '?ref=' + encodeURIComponent(ref));

    try {
      return await requestJson(url, { headers: headers(token, false), cache: 'no-store' });
    } catch (error) {
      if (!error || error.status !== 404) throw error;
      if (options.diagnoseMissing === false) throw error;
      try {
        await requestJson(apiUrl(owner, repo, ''), { headers: headers(token, false), cache: 'no-store' });
      } catch (repoError) {
        if (repoError && repoError.status === 404) throw new PublisherError('Repositório inexistente ou inacessível.', 404, 'REPOSITORY_NOT_FOUND');
        throw repoError;
      }
      try {
        await requestJson(apiUrl(owner, repo, '/branches/' + encodeURIComponent(branch)), { headers: headers(token, false), cache: 'no-store' });
      } catch (branchError) {
        if (branchError && branchError.status === 404) throw new PublisherError('Branch inexistente ou inacessível.', 404, 'BRANCH_NOT_FOUND');
        throw branchError;
      }
      return null;
    }
  }

  function encodeBase64(text) {
    var bytes = new TextEncoder().encode(text);
    var binary = '';
    for (var index = 0; index < bytes.length; index++) binary += String.fromCharCode(bytes[index]);
    return global.btoa(binary);
  }

  function decodeBase64(text) {
    var binary = global.atob(String(text || '').replace(/\s/g, ''));
    var bytes = new Uint8Array(binary.length);
    for (var index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    return new TextDecoder().decode(bytes);
  }

  async function putFile(options) {
    options = options || {};
    var token = requireText(options.token, 'Token');
    var owner = requireText(options.owner, 'Owner');
    var repo = requireText(options.repo, 'Repositório');
    var branch = requireText(options.branch, 'Branch');
    var path = requireText(options.path, 'Caminho');
    var message = requireText(options.commitMessage, 'Mensagem do commit');
    var body = {
      message: message,
      content: encodeBase64(JSON.stringify(options.payload, null, 2)),
      branch: branch
    };
    if (options.sha) body.sha = options.sha;
    return requestJson(apiUrl(owner, repo, '/contents/' + path.split('/').map(encodeURIComponent).join('/')), {
      method: 'PUT',
      headers: headers(token, true),
      body: JSON.stringify(body)
    });
  }

  function comparePayloads(expected, actual) {
    var differences = [];
    ['version', 'updatedAt', 'messageTemplate'].forEach(function (field) {
      if (expected && actual && expected[field] === actual[field]) return;
      differences.push(field + ' divergente');
    });
    var expectedPackageBreaks = expected && Array.isArray(expected.packageBreaks) ? expected.packageBreaks : [];
    var actualPackageBreaks = actual && Array.isArray(actual.packageBreaks) ? actual.packageBreaks : [];
    if (JSON.stringify(expectedPackageBreaks) !== JSON.stringify(actualPackageBreaks)) differences.push('packageBreaks divergente');
    var expectedStayEquivalences = expected && Array.isArray(expected.stayEquivalences) ? expected.stayEquivalences : [];
    var actualStayEquivalences = actual && Array.isArray(actual.stayEquivalences) ? actual.stayEquivalences : [];
    if (JSON.stringify(expectedStayEquivalences) !== JSON.stringify(actualStayEquivalences)) differences.push('stayEquivalences divergente');
    var expectedCheckinBlocks = expected && Array.isArray(expected.checkinBlocks) ? expected.checkinBlocks : [];
    var actualCheckinBlocks = actual && Array.isArray(actual.checkinBlocks) ? actual.checkinBlocks : [];
    if (JSON.stringify(expectedCheckinBlocks) !== JSON.stringify(actualCheckinBlocks)) differences.push('checkinBlocks divergente');
    var expectedDaily = expected && expected.daily && typeof expected.daily === 'object' ? expected.daily : {};
    var actualDaily = actual && actual.daily && typeof actual.daily === 'object' ? actual.daily : {};
    var expectedDates = Object.keys(expectedDaily).sort();
    var actualDates = Object.keys(actualDaily).sort();
    if (expectedDates.length !== actualDates.length || expectedDates.some(function (date, index) { return actualDates[index] !== date; })) {
      differences.push('chaves de daily divergentes');
      return differences;
    }
    var fields = ['base', 'extra', 'minStay', 'cta', 'ctd'];
    expectedDates.forEach(function (date) {
      fields.forEach(function (field) {
        if (expectedDaily[date] && actualDaily[date] && expectedDaily[date][field] === actualDaily[date][field]) return;
        differences.push(date + '.' + field + ' divergente');
      });
    });
    return differences;
  }

  async function verifyFile(options) {
    var remote = await getFile(options);
    if (!remote || typeof remote.content !== 'string') throw new PublisherError('O arquivo publicado não pôde ser relido.', 0, 'VERIFY_READ_FAILED');
    if (options.expectedContentSha && remote.sha !== options.expectedContentSha) {
      throw new PublisherError('O SHA do conteúdo publicado diverge da resposta do GitHub.', 0, 'VERIFY_CONTENT_SHA_MISMATCH');
    }
    var verifiedPayload;
    try { verifiedPayload = JSON.parse(decodeBase64(remote.content)); }
    catch (error) { throw new PublisherError('O arquivo remoto não contém JSON válido.', 0, 'VERIFY_INVALID_JSON'); }
    var differences = comparePayloads(options.payload, verifiedPayload);
    if (differences.length) throw new PublisherError('O conteúdo publicado diverge do payload analisado.', 0, 'VERIFY_MISMATCH', differences.slice(0, 10).join(' | '));
    return { file: remote, payload: verifiedPayload };
  }

  function wait(milliseconds) {
    return new Promise(function (resolve) { global.setTimeout(resolve, milliseconds); });
  }

  async function publishPreview(options) {
    options = options || {};
    var current = await getFile(options);
    var putResult = await putFile({
      token: options.token,
      owner: options.owner,
      repo: options.repo,
      branch: options.branch,
      path: options.path,
      payload: options.payload,
      commitMessage: options.commitMessage,
      sha: current && current.sha
    });
    var commit = putResult && putResult.commit ? putResult.commit : {};
    var content = putResult && putResult.content ? putResult.content : {};
    try {
      if (!commit.sha) throw new PublisherError('O GitHub não retornou o SHA do commit criado.', 0, 'VERIFY_COMMIT_SHA_MISSING');
      var verification = await verifyFile({
        token: options.token,
        owner: options.owner,
        repo: options.repo,
        branch: options.branch,
        ref: commit.sha,
        path: options.path,
        payload: options.payload,
        expectedContentSha: content.sha || '',
        diagnoseMissing: false
      });
      var branchConfirmed = false;
      var delays = [0, 500, 1200, 2500];
      for (var attempt = 0; attempt < delays.length; attempt++) {
        if (delays[attempt]) await wait(delays[attempt]);
        try {
          await verifyFile({
            token: options.token,
            owner: options.owner,
            repo: options.repo,
            branch: options.branch,
            ref: options.branch,
            path: options.path,
            payload: options.payload,
            expectedContentSha: content.sha || '',
            diagnoseMissing: false
          });
          branchConfirmed = true;
          break;
        } catch (branchError) {
          branchConfirmed = false;
        }
      }
      return {
        created: !current,
        verified: true,
        verifiedAtCommit: true,
        branchConfirmed: branchConfirmed,
        propagationPending: !branchConfirmed,
        path: options.path,
        branch: options.branch,
        contentSha: verification.file.sha || content.sha || '',
        commitSha: commit.sha || '',
        commitUrl: commit.html_url || '',
        verifiedPayload: verification.payload
      };
    } catch (error) {
      if (error && !error.commitSha) error.commitSha = commit.sha || '';
      throw error;
    }
  }

  global.TariffPublisher = Object.freeze({
    getFile: getFile,
    putFile: putFile,
    publishPreview: publishPreview,
    verifyFile: verifyFile
  });
})(window);
