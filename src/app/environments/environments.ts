// environments/environment.ts
export const environment = {
  production: true,
  bearerTokens: {
    seguimientoProspecto: "eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiI5ZjhhMjZlZS0xZWFkLTRmN2QtODlhMi0zZGFiZjU2YTNjZGQiLCJzZXNzaW9uSWQiOiI4NTlhN2NmYS1hNDA2LTRmYjItOTY3Yi02MzlmZDBjNmUyMzMiLCJlbWFpbCI6InN1YmFmaWxrbUBrbS5jb20iLCJkZXZpY2VJZCI6IjdlNDMyMDg0MmNmMGNlNzg0MjYyZDgzNzRkZmVlM2QzN2VhYTc3ZThlMjMyNmFmNzY3YWQ2YWRiMjU2NGZhNjciLCJ0eXBlIjoiYWNjZXNzIiwic2NvcGVzIjpbInJlYWQiLCJ3cml0ZSJdLCJpYXQiOjE3ODE5MTUwMTMsImV4cCI6MTc4MTkxODYxM30.YprLcc_8SeAV7V8CCBvIEnBLigHT6U9QtMc4bpJ2YYJrC0K0kVKCt1pebSgVAcc-c1hpPW1K11eve5uzlIoVTA",
    portal: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI3OTEiLCJpc3MiOiJvYXV0aC12MiIsImF1ZCI6ImFjY291bnQiLCJpYXQiOjE3ODEzMDU2NTUsImV4cCI6MTc4MTM0ODg1NSwicGxhdGZvcm0iOiJUWENOSCIsImF6cCI6ImFwaS1jbGllbnQiLCJzY29wZSI6ImVtYWlsIHByb2ZpbGUifQ.-gEh_s1WlWTXaAJUtj00d95B4ueDq5PVAf5TeWDbhVc",
    actualizarDatosComercio: "eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiI5ZjhhMjZlZS0xZWFkLTRmN2QtODlhMi0zZGFiZjU2YTNjZGQiLCJzZXNzaW9uSWQiOiI4NTlhN2NmYS1hNDA2LTRmYjItOTY3Yi02MzlmZDBjNmUyMzMiLCJlbWFpbCI6InN1YmFmaWxrbUBrbS5jb20iLCJkZXZpY2VJZCI6IjdlNDMyMDg0MmNmMGNlNzg0MjYyZDgzNzRkZmVlM2QzN2VhYTc3ZThlMjMyNmFmNzY3YWQ2YWRiMjU2NGZhNjciLCJ0eXBlIjoiYWNjZXNzIiwic2NvcGVzIjpbInJlYWQiLCJ3cml0ZSJdLCJpYXQiOjE3ODE5MTUwMTMsImV4cCI6MTc4MTkxODYxM30.YprLcc_8SeAV7V8CCBvIEnBLigHT6U9QtMc4bpJ2YYJrC0K0kVKCt1pebSgVAcc-c1hpPW1K11eve5uzlIoVTA",
    login: "eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJhNzYwODAwZi1kOWQxLTQxY2MtYjMwMy0yYzg0NzU4YzdiZTYiLCJzZXNzaW9uSWQiOiJmMTA4YjdhMS1mNzUxLTRjZmItYjFmOC04YTY4N2M2ZTg3ZGQiLCJlbWFpbCI6InNhX21vbnlAZ21haWwuY29tIiwiZGV2aWNlSWQiOiJmYTFjNTBkZWVlMjYyOTY5MDJjNTA2MzcxNmFhYTk2MjhiNTU4NmZlMjA2NjE4YjhmNDZkOTk5MmZiNzNlMGRmIiwidHlwZSI6ImFjY2VzcyIsInNjb3BlcyI6WyJyZWFkIiwid3JpdGUiXSwiaWF0IjoxNzgxODk0MjQ5LCJleHAiOjE3ODE4OTc4NDl9.biMkQyPIY1Bl2OKizTvP1tQmFBo4hYw3eWQV4Z2eD-MnxKgvSPdaFA_ddT2U2M7HEhPUeQjRv3BLEJ4k5SpOOw",
  },
  api: {
   
  //Prod
    kashpay: '/api/v3/antares.kwt-v2.2.10/',
  //SDBX
     //kashpay: '/api/v2/antares.kwt-v2.2.10/',
    linkpago: '/OrderReceiver/api/v1/',
    saldos: '/Entities/entities/',
    auth: '/OAuthServices/',
    antaresAuth: '/AntaresAuthAPI/api/v1/',
    entities: '/EntitiesServices/api/aegis.kwt-v1.0.7/',
    aldebaran: '/kwt-a7f2-v1.3.2/',
    voucher: '/KashPay/v2/',
    card: '/CardServices/',
    BEARER_TOKEN: 'eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJ0ZWNzYV90ZWNoX2dlbmVyaWMxQGdtYWlsLmNvbSIsImV4cCI6MTY4NzY1OTU1OSwiaWF0IjoxNjg3NjUzNTgzfQ.PlRXl1AHcQegU2TcrSi_C8bbHs19yjaDaBQ3eZpXiq7ROpERnVVgRp0XNhjqZ-dXLv26-Rkkv1RHBEt71kv-cg',
    documents: '/DocumentsServices/',
    KashpayCoreAPI: '/KashpayCoreAPI/api/v1/',
    SipreladServices: '/SIPRELADServices/api/v1/'
  }
};
