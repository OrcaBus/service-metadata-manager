FROM public.ecr.aws/lambda/python:3.12

WORKDIR ${LAMBDA_TASK_ROOT}

# COPY all files
COPY ./metadata-manager/app/migrations ./migrations
COPY ./infrastructure/stage/construct/lambda-migration/trigger-handler .

# Install the specified packages
RUN pip install -r requirements.txt

# Specify handler
CMD [ "main.handler" ]
