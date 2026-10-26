FROM python:3.12-slim
WORKDIR /app
COPY mcp_crm/requirements.txt mcp_crm/requirements.txt
COPY mcp_crm mcp_crm
RUN pip install --no-cache-dir -r mcp_crm/requirements.txt
CMD ["python", "-m", "mcp_crm"]
